import {createContext, useContext, useMemo} from 'react';
import useSWR from 'swr';
import {toAddress, zeroAddress} from '@builtbymom/web3/utils';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TDict} from '@builtbymom/web3/types';

const KONG_BASE_URL = 'https://kong.yearn.fi/api/rest';
const KONG_LIST_URL = `${KONG_BASE_URL}/list/vaults?origin=yearn`;

type TKongAsset = {
	address?: string | null;
	name?: string | null;
	symbol?: string | null;
	decimals?: number | string | null;
};

type TKongReward = {
	apr?: number | string | null;
	isFinished?: boolean | null;
};

type TKongPerformance = {
	oracle?: {apr?: number | null; apy?: number | null; netAPY?: number | null} | null;
	estimated?: {
		apr?: number | null;
		apy?: number | null;
		type?: string | null;
		components?: {boost?: number | null; poolAPY?: number | null; boostedAPR?: number | null; baseAPR?: number | null; rewardsAPR?: number | null} | null;
	} | null;
	historical?: {net?: number | null; weeklyNet?: number | null; monthlyNet?: number | null; inceptionNet?: number | null} | null;
};

type TKongVault = {
	chainId: number;
	address: string;
	name?: string | null;
	symbol?: string | null;
	apiVersion?: string | null;
	decimals?: number | string | null;
	asset?: TKongAsset | null;
	tvl?: number | string | null;
	pricePerShare?: number | string | null;
	performance?: TKongPerformance | null;
	fees?: {managementFee?: number | null; performanceFee?: number | null} | null;
	category?: string | null;
	type?: string | null;
	kind?: string | null;
	isRetired?: boolean | null;
	isHidden?: boolean | null;
	isBoosted?: boolean | null;
	isHighlighted?: boolean | null;
	strategiesCount?: number | null;
	riskLevel?: number | null;
	migration?: boolean | Record<string, unknown> | null;
	staking?: {address?: string | null; available?: boolean | null; source?: string | null} | null;
};

type TKongSnapshot = {
	apiVersion?: string | null;
	chainId?: number | null;
	address?: string | null;
	asset?: TKongAsset | null;
	decimals?: number | string | null;
	totalAssets?: string | number | null;
	tvl?: {close?: number | string | null} | null;
	performance?: TKongPerformance | null;
	staking?: {address?: string | null; available?: boolean | null; rewards?: TKongReward[] | null} | null;
	meta?: {
		kind?: string | null;
		type?: string | null;
		category?: string | null;
		name?: string | null;
		isRetired?: boolean | null;
		isHidden?: boolean | null;
		isBoosted?: boolean | null;
		isHighlighted?: boolean | null;
		migration?: {target?: string | null; contract?: string | null; available?: boolean | null} | null;
	} | null;
};

type TKongSnapshotResult = {key: string; snapshot?: TKongSnapshot; error?: true};

type TYearnContext = {
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoadingVaultList: boolean;
	isVaultListError: boolean;
	mutateVaultList: () => Promise<unknown>;
};

const defaultContext: TYearnContext = {
	vaults: {},
	vaultsMigrations: {},
	vaultsRetired: {},
	isLoadingVaultList: true,
	isVaultListError: false,
	mutateVaultList: async (): Promise<void> => undefined
};

function finiteNumber(value: number | string | null | undefined): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Kong request failed (${response.status})`);
	}
	return (await response.json()) as T;
}

const MAX_CONCURRENT_SNAPSHOTS = 8;
let activeSnapshots = 0;
const snapshotWaiters: Array<() => void> = [];

async function fetchSnapshot(chainId: number | string, address: string): Promise<TKongSnapshot> {
	if (activeSnapshots >= MAX_CONCURRENT_SNAPSHOTS) {
		await new Promise<void>(resolve => snapshotWaiters.push(resolve));
	}
	activeSnapshots += 1;
	try {
		return await fetchJson<TKongSnapshot>(`${KONG_BASE_URL}/snapshot/${chainId}/${address.toLowerCase()}`);
	} finally {
		activeSnapshots -= 1;
		snapshotWaiters.shift()?.();
	}
}

function snapshotKey(vault: TKongVault): string {
	return `${vault.chainId}/${vault.address.toLowerCase()}`;
}

function hasMigration(vault: TKongVault): boolean {
	return vault.migration === true || (typeof vault.migration === 'object' && vault.migration !== null);
}

function parseRawAmount(value: string | number | null | undefined): bigint | undefined {
	if (typeof value === 'string' && /^\d+$/.test(value)) {
		return BigInt(value);
	}
	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
		return BigInt(value);
	}
	return undefined;
}

export function useKongVaultTotalAssets(
	chainId: number,
	address: string
): {totalAssets?: bigint; error: boolean; isLoading: boolean} {
	const key = `${KONG_BASE_URL}/snapshot/${chainId}/${address.toLowerCase()}`;
	const {data, error, isLoading} = useSWR<TKongSnapshot>(key, () => fetchSnapshot(chainId, address));
	return {totalAssets: error ? undefined : parseRawAmount(data?.totalAssets), error: Boolean(error), isLoading};
}

async function fetchSnapshots(serializedKeys: string): Promise<TKongSnapshotResult[]> {
	const keys = JSON.parse(serializedKeys) as string[];
	return Promise.all(
		keys.map(async (key): Promise<TKongSnapshotResult> => {
			try {
				const [chainId, address] = key.split('/');
				const snapshot = await fetchSnapshot(chainId, address);
				return {key, snapshot};
			} catch {
				return {key, error: true};
			}
		})
	);
}

function mapKongVault(vault: TKongVault, snapshot?: TKongSnapshot, listError = false): TYDaemonVault {
	const meta = snapshot?.meta;
	const asset = snapshot?.asset || vault.asset;
	const performance = snapshot?.performance || (listError ? undefined : vault.performance);
	const estimated = performance?.estimated;
	const historical = performance?.historical;
	const stakingRewards = snapshot?.staking?.rewards;
	const activeRewardAPRs = (stakingRewards || [])
		.filter(reward => reward.isFinished !== true)
		.map(reward => finiteNumber(reward.apr));
	const stakingRewardsAPR =
		stakingRewards && activeRewardAPRs.every(apr => apr !== undefined)
			? activeRewardAPRs.reduce((total, apr) => total + (apr as number), 0)
			: Number.NaN;
	const migration = meta?.migration;
	const totalAssetsValue = parseRawAmount(snapshot?.totalAssets);
	const decimalValue = finiteNumber(snapshot?.decimals ?? vault.decimals ?? asset?.decimals) ?? Number.NaN;
	const listTVL = finiteNumber(vault.tvl);
	const snapshotTVL = finiteNumber(snapshot?.tvl?.close);
	const forwardAPR = finiteNumber(estimated?.apr);
	const managementFee = finiteNumber(vault.fees?.managementFee);
	const performanceFee = finiteNumber(vault.fees?.performanceFee);

	return {
		address: toAddress(vault.address),
		version: snapshot?.apiVersion || vault.apiVersion || '',
		type: (meta?.type || vault.type || 'Yearn Vault') as TYDaemonVault['type'],
		kind: (meta?.kind || vault.kind || 'Legacy') as TYDaemonVault['kind'],
		symbol: vault.symbol || '',
		name: meta?.name || vault.name || '',
		description: '',
		category: (meta?.category || vault.category || 'Volatile') as TYDaemonVault['category'],
		decimals: decimalValue,
		chainID: vault.chainId,
		token: {
			address: asset?.address ? toAddress(asset.address) : (undefined as unknown as `0x${string}`),
			name: asset?.name || '',
			symbol: asset?.symbol || '',
			description: '',
			decimals: finiteNumber(asset?.decimals) ?? Number.NaN
		},
		tvl: {
			totalAssets: totalAssetsValue as bigint,
			tvl: listError ? Number.NaN : snapshotTVL ?? listTVL ?? Number.NaN,
			price: Number.NaN
		},
		apr: {
			type: historical?.net === null ? 'new' : 'historical',
			netAPR: finiteNumber(historical?.net) ?? Number.NaN,
			fees: {
				management: managementFee === undefined ? Number.NaN : managementFee / 10000,
				performance: performanceFee === undefined ? Number.NaN : performanceFee / 10000,
				withdrawal: Number.NaN
			},
			extra: {stakingRewardsAPR},
			points: {
				weekAgo: finiteNumber(historical?.weeklyNet) ?? Number.NaN,
				monthAgo: finiteNumber(historical?.monthlyNet) ?? Number.NaN,
				inception: finiteNumber(historical?.inceptionNet) ?? Number.NaN
			},
			forwardAPR: {
				type: forwardAPR === undefined ? estimated?.type || 'unavailable' : estimated?.type || 'estimated',
				netAPR: forwardAPR ?? Number.NaN,
				composite: {
					boost: finiteNumber(estimated?.components?.boost) ?? Number.NaN,
					poolAPY: finiteNumber(estimated?.components?.poolAPY) ?? Number.NaN,
					boostedAPR: finiteNumber(estimated?.components?.boostedAPR) ?? Number.NaN,
					baseAPR: finiteNumber(estimated?.components?.baseAPR) ?? Number.NaN,
					rewardsAPR: finiteNumber(estimated?.components?.rewardsAPR) ?? Number.NaN
				}
			}
		},
		featuringScore: Number.NaN,
		retired: meta?.isRetired ?? vault.isRetired ?? false,
		boosted: meta?.isBoosted ?? vault.isBoosted ?? false,
		strategies: [],
		staking: {
			address: toAddress(snapshot?.staking?.address || vault.staking?.address || zeroAddress),
			available: snapshot?.staking?.available ?? vault.staking?.available ?? false
		},
		migration: {
			available: migration?.available ?? vault.migration === true,
			address: migration?.target ? toAddress(migration.target) : (undefined as unknown as `0x${string}`),
			contract: migration?.contract ? toAddress(migration.contract) : (undefined as unknown as `0x${string}`)
		},
		info: {sourceURL: ''}
	} as unknown as TYDaemonVault;
}

const YearnContext = createContext<TYearnContext>(defaultContext);

export function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const {data: rows, error: listError, mutate, isLoading} = useSWR<TKongVault[]>(KONG_LIST_URL, fetchJson);
	const requiredSnapshotKeys = useMemo((): string[] => {
		return (rows || [])
			.filter(vault => hasMigration(vault) || vault.staking?.available === true)
			.map(snapshotKey)
			.sort();
	}, [rows]);
	const serializedSnapshotKeys = useMemo(
		(): string | null => (requiredSnapshotKeys.length ? JSON.stringify(requiredSnapshotKeys) : null),
		[requiredSnapshotKeys]
	);
	const {
		data: snapshotResults,
		error: snapshotError,
		isLoading: snapshotsLoading,
		mutate: mutateSnapshots
	} = useSWR<TKongSnapshotResult[]>(serializedSnapshotKeys, fetchSnapshots);
	const snapshots = useMemo((): Map<string, TKongSnapshot> => {
		const result = new Map<string, TKongSnapshot>();
		if (snapshotError) {
			return result;
		}
		for (const entry of snapshotResults || []) {
			if (entry.snapshot) {
				result.set(entry.key, entry.snapshot);
			}
		}
		return result;
	}, [snapshotResults, snapshotError]);
	const vaultCollections = useMemo(() => {
		const active: TDict<TYDaemonVault> = {};
		const migrations: TDict<TYDaemonVault> = {};
		const retired: TDict<TYDaemonVault> = {};
		for (const row of rows || []) {
			const vault = mapKongVault(row, snapshots.get(snapshotKey(row)), Boolean(listError));
			if (hasMigration(row)) {
				migrations[vault.address] = vault;
			}
			if (row.isRetired) {
				retired[vault.address] = vault;
				continue;
			}
			if (!row.isHidden && !hasMigration(row)) {
				active[vault.address] = vault;
			}
		}
		return {active, migrations, retired};
	}, [rows, snapshots, listError]);
	const snapshotFailures = useMemo(
		(): number => (snapshotResults || []).filter(entry => entry.error).length,
		[snapshotResults]
	);
	const contextValue = useMemo(
		(): TYearnContext => ({
			vaults: vaultCollections.active,
			vaultsMigrations: vaultCollections.migrations,
			vaultsRetired: vaultCollections.retired,
			isLoadingVaultList: isLoading || snapshotsLoading,
			isVaultListError: Boolean(listError || snapshotError || snapshotFailures),
			mutateVaultList: async (): Promise<unknown> => Promise.all([mutate(), mutateSnapshots()])
		}),
		[vaultCollections, isLoading, snapshotsLoading, listError, snapshotError, snapshotFailures, mutate, mutateSnapshots]
	);

	return (
		<YearnContext.Provider value={contextValue}>
			{contextValue.isVaultListError ? (
				<div
					role={'alert'}
					className={'mx-auto mt-4 max-w-6xl bg-amber-100 px-4 py-3 text-sm text-amber-900'}>
					{'Some Kong vault data is unavailable. Affected APR, staking reward, or migration details may be incomplete.'}
				</div>
			) : null}
			{children}
		</YearnContext.Provider>
	);
}

export const useYearn = (): TYearnContext => useContext(YearnContext);

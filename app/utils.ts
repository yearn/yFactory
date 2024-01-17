import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

export const YFACTORY_SUPPORTED_NETWORK = 1;

export const ALL_VAULTS_FACTORY_CATEGORIES = {
	curveF: 'Curve Factory Vaults',
	holdingsF: 'Holdings'
};

export const ALL_VAULTS_FACTORY_CATEGORIES_KEYS = Object.keys(ALL_VAULTS_FACTORY_CATEGORIES);

export function getVaultName(vault: TYDaemonVault): string {
	const baseName = vault.name;
	if (baseName.includes(' yVault')) {
		return baseName.replace(' yVault', '');
	}
	return baseName;
}

const VAULT_CATEGORIES = [
	'All Vaults',
	'Featured Vaults',
	'Popular Vaults',
	'Crypto Vaults',
	'Stables Vaults',
	'Boosted Vaults',
	'Curve Vaults',
	'Balancer Vaults',
	'Velodrome Vaults',
	'Aerodrome Vaults',
	'Holdings',
	'Migrations'
] as const;
export type TVaultListHeroCategory = (typeof VAULT_CATEGORIES)[number];

export function isValidCategory<T extends string>(input: string): input is T {
	return VAULT_CATEGORIES.includes(input as TVaultListHeroCategory);
}

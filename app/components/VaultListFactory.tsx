import {useMemo} from 'react';
import {useVaultFilter} from 'app/hooks/useFilteredVaults';
import {useSortVaults} from 'app/hooks/useSortVaults';
import {useQueryArguments} from 'app/hooks/useVaultsQueryArgs';
import {ALL_VAULTS_FACTORY_CATEGORIES_KEYS} from 'app/utils';
import {isZero} from '@builtbymom/web3/utils';
import {useYearn} from '@yearn-finance/web-lib/contexts/useYearn';
import {IconChain} from '@yearn-finance/web-lib/icons/IconChain';

import {ListHead} from './ListHead';
import {VaultsListEmptyFactory} from './VaultsListEmpty';
import {VaultsListRow} from './VaultsListRow';
import {SearchBar} from './common/SearchBar';

import type {TPossibleSortBy} from 'app/hooks/useSortVaults';
import type {ReactElement, ReactNode} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';

export function VaultListFactory(): ReactElement {
	const {isLoadingVaultList} = useYearn();
	const {
		search,
		categories,
		chains,
		sortDirection,
		sortBy,
		onSearch,
		onChangeSortDirection,
		onChangeSortBy,
		onReset
	} = useQueryArguments({defaultCategories: ALL_VAULTS_FACTORY_CATEGORIES_KEYS});
	const {activeVaults} = useVaultFilter(categories, chains);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, on the activeVaults list, we apply the search filter. The search filter is
	 **	implemented as a simple string.includes() on the vault name.
	 **********************************************************************************************/
	const searchedVaultsToDisplay = useMemo((): TYDaemonVault[] => {
		if (!search) {
			return activeVaults;
		}
		return activeVaults.filter((vault: TYDaemonVault): boolean => {
			const lowercaseSearch = search.toLowerCase();
			const allSearchWords = lowercaseSearch.split(' ');
			const currentVaultInfo =
				`${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`
					.replaceAll('-', ' ')
					.toLowerCase()
					.split(' ');
			return allSearchWords.every((word): boolean => currentVaultInfo.some((v): boolean => v.startsWith(word)));
		});
	}, [activeVaults, search]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults([...searchedVaultsToDisplay], sortBy, sortDirection);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	The VaultList component is memoized to prevent it from being re-created on every render.
	 **	It contains either the list of vaults, is some are available, or a message to the user.
	 **********************************************************************************************/
	const VaultList = useMemo((): ReactNode => {
		const filteredByChains = sortedVaultsToDisplay.filter(
			({chainID}): boolean => chains?.includes(chainID) || false
		);

		if (isLoadingVaultList || isZero(filteredByChains.length) || !chains || chains.length === 0) {
			return (
				<VaultsListEmptyFactory
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={filteredByChains}
					currentSearch={search || ''}
					currentCategories={categories}
					currentChains={chains}
					onReset={onReset}
				/>
			);
		}
		return filteredByChains.map((vault): ReactNode => {
			if (!vault) {
				return null;
			}
			return (
				<VaultsListRow
					key={`${vault.chainID}_${vault.address}`}
					currentVault={vault}
				/>
			);
		});
	}, [categories, chains, isLoadingVaultList, onReset, search, sortedVaultsToDisplay]);

	return (
		<div className={'relative col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'mb-10 flex flex-col px-4 pb-0 pt-4 md:px-10 md:pt-10'}>
				<div className={'flex w-full items-center justify-between'}>
					<h2 className={'text-3xl font-bold'}>{'Curve Factory Vaults'}</h2>
					<div>
						<small>{'Search'}</small>
						<SearchBar
							className={'md:w-full md:min-w-96'}
							searchPlaceholder={'YFI Vault'}
							searchValue={search || ''}
							onSearch={onSearch}
						/>
					</div>
				</div>
			</div>

			<ListHead
				dataClassName={'grid-cols-10'}
				sortBy={sortBy}
				sortDirection={sortDirection}
				onSort={(newSortBy: string, newSortDirection: string): void => {
					onChangeSortBy(newSortBy as TPossibleSortBy);
					onChangeSortDirection(newSortDirection as TSortDirection);
				}}
				items={[
					{label: <IconChain />, value: 'chain', sortable: false, className: 'col-span-1'},
					{label: 'Token', value: 'name', sortable: true},
					{label: 'Est. APR', value: 'estAPR', sortable: true, className: 'col-span-2'},
					{label: 'Hist. APR', value: 'apr', sortable: true, className: 'col-span-2'},
					{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
					{label: 'Holdings', value: 'deposited', sortable: true, className: 'col-span-2'},
					{label: 'Deposits', value: 'tvl', sortable: true, className: 'col-span-2'}
				]}
			/>

			{VaultList}
		</div>
	);
}

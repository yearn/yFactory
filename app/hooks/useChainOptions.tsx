import {useConnect} from 'wagmi';
import {useCustomCompareMemo, useDeepCompareMemo} from '@react-hookz/web';
import {ImageWithFallback} from '@yearn-finance/web-lib/components/ImageWithFallback';

import type {TMultiSelectOptionProps} from 'app/components/common/MultiSelectDropdown';
import type {Connector} from 'wagmi';
import type {Chain} from '@wagmi/chains';

export function useChainOptions(chains: number[] | null): TMultiSelectOptionProps[] {
	const {connectors} = useConnect();

	const injectedChains = useCustomCompareMemo(
		(): Chain[] | undefined => {
			const injectedConnector = connectors.find((e): boolean => e.id.toLocaleLowerCase() === 'injected');
			if (!injectedConnector) {
				return [];
			}
			const noFork = injectedConnector.chains.filter(({id}): boolean => id !== 1337);
			return noFork;
		},
		[connectors],
		(savedDeps: [Connector[]], deps: [Connector[]]): boolean => {
			for (const savedDep of savedDeps[0]) {
				if (!deps[0].find((dep): boolean => dep.id === savedDep.id)) {
					return false;
				}
			}
			return true;
		}
	);

	const options = useDeepCompareMemo((): TMultiSelectOptionProps[] => {
		const _options = [];
		for (const chain of injectedChains || []) {
			_options.push({
				label: chain.name,
				value: chain.id,
				isSelected: chains?.includes(chain.id) || false,
				icon: (
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_CHAIN_URI}/${chain.id}/logo-32.png`}
						alt={chain.name}
						width={32}
						height={32}
					/>
				)
			});
		}
		return _options;
	}, [injectedChains, chains]);

	return options;
}

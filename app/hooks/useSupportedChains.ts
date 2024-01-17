import {useMemo} from 'react';
import {useConnect} from 'wagmi';

import type {Chain} from '@wagmi/chains';

export function useSupportedChains(): Chain[] {
	const {connectors} = useConnect();

	const supportedChains = useMemo((): Chain[] => {
		const injectedConnector = connectors.find((e): boolean => e.id.toLocaleLowerCase() === 'injected');
		if (!injectedConnector) {
			return [];
		}
		const noFork = injectedConnector.chains.filter(({id}): boolean => id !== 1337);
		return noFork;
	}, [connectors]);

	return supportedChains;
}

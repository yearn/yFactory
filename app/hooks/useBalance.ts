import useWallet from '@builtbymom/web3/contexts/useWallet';
import {toAddress} from '@yearn-finance/web-lib/utils/address';

import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {TAddress, TDict} from '@builtbymom/web3/types';

export function useBalance({
	address,
	chainID
}: {
	address: string | TAddress;
	chainID: number;
	source?: TDict<TNormalizedBN>;
}): TNormalizedBN {
	const {getBalance} = useWallet();

	return getBalance({address: toAddress(address), chainID: chainID});
}

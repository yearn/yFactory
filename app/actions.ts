import {toBigInt} from '@builtbymom/web3/utils';
import {assertAddress} from '@builtbymom/web3/utils/assert';
import {handleTx, toWagmiProvider} from '@builtbymom/web3/utils/wagmi/provider';
import {getPublicClient} from '@wagmi/core';
import {VAULT_FACTORY_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import {VAULT_FACTORY_ABI} from './abi/vaultFactory.abi';

import type {TAddress} from '@builtbymom/web3/types/address';
import type {TTxResponse, TWriteTransaction} from '@builtbymom/web3/utils/wagmi';

/* 🔵 - Yearn Finance **********************************************************
 ** createNewVaultsAndStrategies is a _WRITE_ function that creates a new vault
 ** and strategy for the given gauge.
 **
 ** @app - Vaults (veCRV)
 ** @param gaugeAddress - the base gauge address
 ******************************************************************************/
type TCreateNewVaultsAndStrategies = TWriteTransaction & {
	gaugeAddress: TAddress | undefined;
};
export async function createNewVaultsAndStrategies(props: TCreateNewVaultsAndStrategies): Promise<TTxResponse> {
	assertAddress(VAULT_FACTORY_ADDRESS, 'VAULT_FACTORY_ADDRESS');
	assertAddress(props.gaugeAddress, 'gaugeAddress');

	return await handleTx(props, {
		address: VAULT_FACTORY_ADDRESS,
		abi: VAULT_FACTORY_ABI,
		functionName: 'createNewVaultsAndStrategies',
		args: [props.gaugeAddress]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** gasOfCreateNewVaultsAndStrategies is a _READ_ function that estimate the gas
 ** of the createNewVaultsAndStrategies function.
 **
 ** @app - Vaults (veCRV)
 ** @param gaugeAddress - the base gauge address
 ******************************************************************************/
export async function gasOfCreateNewVaultsAndStrategies(props: TCreateNewVaultsAndStrategies): Promise<bigint> {
	try {
		assertAddress(props.contractAddress, 'contractAddress');
		assertAddress(props.gaugeAddress, 'gaugeAddress');

		const wagmiProvider = await toWagmiProvider(props.connector);
		const client = await getPublicClient({chainId: wagmiProvider.chainId});
		const gas = await client.estimateContractGas({
			address: VAULT_FACTORY_ADDRESS,
			abi: VAULT_FACTORY_ABI,
			functionName: 'createNewVaultsAndStrategies',
			args: [props.gaugeAddress],
			account: wagmiProvider.address
		});
		return toBigInt(gas);
	} catch (error) {
		console.error(error);
		return toBigInt(0);
	}
}

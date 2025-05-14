import {createContext, useContext, useMemo} from 'react';
import {useFetch} from '@builtbymom/web3/hooks/useFetch';
import {coinGeckoPricesSchema} from '@yearn-finance/web-lib/utils/schemas/coinGeckoSchemas';

import {curveAllGaugesSchema} from './schema';

import type {TCoinGeckoPrices} from '@yearn-finance/web-lib/utils/schemas/coinGeckoSchemas';
import type {TCurveAllGauges, TCurveGauge} from './schema';

export type TCurveContext = {
	cgPrices: TCoinGeckoPrices;
	gauges: TCurveGauge[];
	isLoadingGauges: boolean;
};

const defaultProps: TCurveContext = {
	cgPrices: {},
	gauges: [],
	isLoadingGauges: false
};

const CurveContext = createContext<TCurveContext>(defaultProps);
export const CurveContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const cgPricesQueryParams = new URLSearchParams({
		ids: 'curve-dao-token',
		vs_currencies: 'usd'
	});

	const {data: cgPrices} = useFetch<TCoinGeckoPrices>({
		endpoint: `https://api.coingecko.com/api/v3/simple/price?${cgPricesQueryParams}`,
		schema: coinGeckoPricesSchema
	});

	/* 🔵 - Yearn Finance ******************************************************
	 **	Fetch all the CurveGauges to be able to create some new if required
	 ***************************************************************************/
	const {data: gaugesWrapper, isLoading: isLoadingGauges} = useFetch<TCurveAllGauges>({
		endpoint: 'https://api.curve.finance/v1/getAllGauges',
		schema: curveAllGaugesSchema
	});

	const gauges = useMemo((): TCurveGauge[] => {
		const _gaugesForMainnet: TCurveGauge[] = [];
		for (const gauge of Object.values(gaugesWrapper?.data || {})) {
			if (gauge.is_killed) {
				continue;
			}
			if (gauge.side_chain) {
				continue;
			}

			const addressPart = /\([^()]*\)/;
			gauge.name = gauge.name.replace(addressPart, '');
			_gaugesForMainnet.push(gauge);
		}
		return _gaugesForMainnet;
	}, [gaugesWrapper]);

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useMemo(
		(): TCurveContext => ({
			cgPrices: cgPrices || defaultProps.cgPrices,
			gauges: gauges || defaultProps.gauges,
			isLoadingGauges: isLoadingGauges || defaultProps.isLoadingGauges
		}),
		[cgPrices, gauges, isLoadingGauges]
	);

	return <CurveContext.Provider value={contextValue}>{children}</CurveContext.Provider>;
};

export const useCurve = (): TCurveContext => useContext(CurveContext);

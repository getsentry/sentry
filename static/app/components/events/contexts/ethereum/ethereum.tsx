import {Fragment} from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getUnknownData from '../getUnknownData';

import getEthereumKnownData from './getEthereumKnownData';
import {EthereumData, EthereumKnownDataType} from './types';

type Props = {
  data: EthereumData;
};

const ethereumKnownDataValues = [
  EthereumKnownDataType.TRANSACTION_HASH,
  EthereumKnownDataType.BLOCK,
  EthereumKnownDataType.CUMULATIVE_GAS_USED,
  EthereumKnownDataType.EFFECTIVE_GAS_PRICE,
  EthereumKnownDataType.FROM,
  EthereumKnownDataType.GAS,
  EthereumKnownDataType.GAS_PRICE,
  EthereumKnownDataType.GAS_USED,
  EthereumKnownDataType.STATUS,
  EthereumKnownDataType.TO,
];

const Ethereum = ({data}: Props) => {
  return (
    <Fragment>
      <ContextBlock data={getEthereumKnownData(data, ethereumKnownDataValues)} />
      <ContextBlock data={getUnknownData(data, ethereumKnownDataValues)} />
    </Fragment>
  );
};

export default Ethereum;

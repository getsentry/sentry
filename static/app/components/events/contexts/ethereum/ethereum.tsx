import {Fragment} from 'react';

import KeyValueList from 'app/components/events/interfaces/keyValueList';

import getUnknownData from '../getUnknownData';

import getEthereumKnownData from './getEthereumKnownData';
import {EthereumData, EthereumKnownDataType} from './types';

type Props = {
  data: EthereumData;
};

const ethereumKnownDataValues = [
  EthereumKnownDataType.TRANSACTION_HASH,
  EthereumKnownDataType.STATUS,
  EthereumKnownDataType.BLOCK,
  EthereumKnownDataType.FROM,
  EthereumKnownDataType.TO,
  EthereumKnownDataType.GAS,
  EthereumKnownDataType.GAS_USED,
  EthereumKnownDataType.CUMULATIVE_GAS_USED,
  EthereumKnownDataType.GAS_PRICE,
  EthereumKnownDataType.EFFECTIVE_GAS_PRICE,
];

const Ethereum = ({data}: Props) => {
  return (
    <Fragment>
      <KeyValueList
        isSorted={false}
        data={getEthereumKnownData(data, ethereumKnownDataValues)}
      />
      <KeyValueList data={getUnknownData(data, ethereumKnownDataValues)} />
    </Fragment>
  );
};

export default Ethereum;

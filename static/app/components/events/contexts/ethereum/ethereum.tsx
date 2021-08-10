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
  EthereumKnownDataType.VALUE,
  EthereumKnownDataType.TRANSACTION_FEE,
  EthereumKnownDataType.GAS_PRICE,
  EthereumKnownDataType.GAS,
  EthereumKnownDataType.GAS_USED,
];

const ethereumIgnoredDataValues = [
  EthereumKnownDataType.CUMULATIVE_GAS_USED,
  EthereumKnownDataType.EFFECTIVE_GAS_PRICE,
];

const Ethereum = ({data}: Props) => {
  return (
    <Fragment>
      <KeyValueList
        isSorted={false}
        data={getEthereumKnownData(data, ethereumKnownDataValues)}
      />
      <KeyValueList
        data={getUnknownData(data, [
          ...ethereumKnownDataValues,
          ...ethereumIgnoredDataValues,
        ])}
      />
    </Fragment>
  );
};

export default Ethereum;

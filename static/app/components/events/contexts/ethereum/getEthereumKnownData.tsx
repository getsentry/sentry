import {getMeta} from 'app/components/events/meta/metaProxy';
import {KeyValueListData} from 'app/types';
import {defined} from 'app/utils';

import getEthereumKnownDataDetails from './getEthereumKnownDataDetails';
import {EthereumData, EthereumKnownDataType} from './types';

function getEthereumKnownData(
  data: EthereumData,
  ethereumKnownDataValues: Array<EthereumKnownDataType>
): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = ethereumKnownDataValues.filter(ethereumKnownDataValue =>
    defined(data[ethereumKnownDataValue])
  );

  for (const key of dataKeys) {
    const knownDataDetails = getEthereumKnownDataDetails(
      data,
      key as EthereumKnownDataType
    );

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getEthereumKnownData;

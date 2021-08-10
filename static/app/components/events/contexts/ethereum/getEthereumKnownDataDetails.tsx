import {t} from 'app/locale';

import {EthereumData, EthereumKnownDataType} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

function getEthereumKnownDataDetails(
  data: EthereumData,
  type: EthereumKnownDataType
): Output {
  switch (type) {
    case EthereumKnownDataType.TRANSACTION_HASH:
      return {
        subject: t('Transaction Hash'),
        value: data.transactionHash,
      };
    default:
      return {
        subject: type,
        value: data[type],
      };
  }
}

export default getEthereumKnownDataDetails;

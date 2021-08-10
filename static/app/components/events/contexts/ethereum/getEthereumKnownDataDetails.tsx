import styled from '@emotion/styled';

import ExternalLink from 'app/components/links/externalLink';
import Tooltip from 'app/components/tooltip';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import {formatWei} from 'app/utils/ethereum';

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
        value: (
          <OpenEtherscan
            text={data.transactionHash}
            link={`https://etherscan.io/tx/${data.transactionHash}`}
          />
        ),
      };
    case EthereumKnownDataType.STATUS:
      return {
        subject: t('Status'),
        value: data.status ? t('Success') : t('Fail') + ` (${data.status})`,
      };
    case EthereumKnownDataType.BLOCK:
      return {
        subject: t('Block'),
        value: (
          <OpenEtherscan
            text={data.block}
            link={`https://etherscan.io/block/${data.block}`}
          />
        ),
      };
    case EthereumKnownDataType.FROM:
      return {
        subject: t('From'),
        value: (
          <OpenEtherscan
            text={data.from}
            link={`https://etherscan.io/address/${data.from}`}
          />
        ),
      };
    case EthereumKnownDataType.TO:
      return {
        subject: t('To'),
        value: (
          <OpenEtherscan
            text={data.to}
            link={`https://etherscan.io/address/${data.to}`}
          />
        ),
      };
    case EthereumKnownDataType.GAS:
      return {
        subject: t('Gas'),
        value: data.gas.toLocaleString(),
      };
    case EthereumKnownDataType.GAS_USED:
      return {
        subject: t('Gas Used'),
        value: data.gasUsed.toLocaleString(),
      };
    case EthereumKnownDataType.CUMULATIVE_GAS_USED:
      return {
        subject: t('Cumulative Gas Used'),
        value: data.cumulativeGasUsed.toLocaleString(),
      };
    case EthereumKnownDataType.GAS_PRICE:
      return {
        subject: t('Gas Price'),
        value: `${formatWei(data.gasPrice)} Ether (${formatWei(
          data.gasPrice,
          'gwei'
        )} Gwei)`,
      };
    case EthereumKnownDataType.EFFECTIVE_GAS_PRICE:
      return {
        subject: t('Effective Gas Price'),
        value: `${formatWei(data.effectiveGasPrice)} Ether (${formatWei(
          data.effectiveGasPrice,
          'gwei'
        )} Gwei)`,
      };
    default:
      return {
        subject: type,
        value: data[type],
      };
  }
}

function OpenEtherscan({text, link}) {
  return (
    <Wrapper>
      {text}{' '}
      <Tooltip title={t('View on Etherscan')}>
        <ExternalLink href={link}>
          <IconOpen size="xs" />
        </ExternalLink>
      </Tooltip>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export default getEthereumKnownDataDetails;

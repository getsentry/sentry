import styled from '@emotion/styled';
import round from 'lodash/round';

import Button from 'app/components/button';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {percent} from 'app/utils';
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
    case EthereumKnownDataType.VALUE:
      return {
        subject: t('Value'),
        value: `${formatWei(data.value)} Ether`,
      };
    case EthereumKnownDataType.TRANSACTION_FEE:
      return {
        subject: t('Transaction Fee'),
        value: `${formatWei(data.transactionFee)} Ether`,
      };
    case EthereumKnownDataType.GAS:
      return {
        subject: t('Gas Limit'),
        value: data.gas.toLocaleString(),
      };
    case EthereumKnownDataType.GAS_USED:
      return {
        subject: t('Gas Used'),
        value: `${data.gasUsed.toLocaleString()} (${round(
          percent(data.gasUsed, data.gas),
          2
        )}%)`,
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
    <ButtonWrapper>
      <pre className="val">
        <span className="val-string">{text}</span>
      </pre>
      <StyledButton size="xsmall" href={link} external icon={<IconOpen size="xs" />}>
        {t('Etherscan')}
      </StyledButton>
    </ButtonWrapper>
  );
}

const ButtonWrapper = styled('div')`
  position: relative;
`;

const StyledButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

export default getEthereumKnownDataDetails;

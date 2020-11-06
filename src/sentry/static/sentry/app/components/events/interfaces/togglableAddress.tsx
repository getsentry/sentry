import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {IconFilter} from 'app/icons';
import {formatAddress, parseAddress} from 'app/components/events/interfaces/utils';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Theme} from 'app/utils/theme';

type Props = {
  address: string;
  startingAddress: string | null;
  isAbsolute: boolean;
  isFoundByStackScanning: boolean;
  isInlineFrame: boolean;
  relativeAddressMaxlength?: number;
  onToggle?: (event: React.MouseEvent<SVGElement>) => void;
};

const TogglableAddress = ({
  startingAddress,
  address,
  relativeAddressMaxlength,
  isInlineFrame,
  isFoundByStackScanning,
  isAbsolute,
  onToggle,
}: Props) => {
  const convertAbsoluteAddressToRelative = () => {
    if (!startingAddress) {
      return '';
    }

    const relativeAddress = formatAddress(
      parseAddress(address) - parseAddress(startingAddress),
      relativeAddressMaxlength
    );

    return `+${relativeAddress}`;
  };

  const getAddressTooltip = () => {
    if (isInlineFrame && isFoundByStackScanning) {
      return t('Inline frame, found by stack scanning');
    }

    if (isInlineFrame) {
      return t('Inline frame');
    }

    if (isFoundByStackScanning) {
      return t('Found by stack scanning');
    }

    return undefined;
  };

  const relativeAddress = convertAbsoluteAddressToRelative();
  const canBeConverted = !!(onToggle && relativeAddress);
  const formattedAddress = !relativeAddress || isAbsolute ? address : relativeAddress;
  const tooltipTitle = getAddressTooltip();

  return (
    <Wrapper>
      {canBeConverted && (
        <AddressIconTooltip
          title={isAbsolute ? t('Switch to absolute') : t('Switch to relative')}
          containerDisplayMode="inline-flex"
        >
          <AddressToggleIcon onClick={onToggle} size="xs" color="purple300" />
        </AddressIconTooltip>
      )}
      <Tooltip title={tooltipTitle} disabled={!(isFoundByStackScanning || isInlineFrame)}>
        <Address
          isFoundByStackScanning={isFoundByStackScanning}
          isInlineFrame={isInlineFrame}
          canBeConverted={canBeConverted}
        >
          {formattedAddress}
        </Address>
      </Tooltip>
    </Wrapper>
  );
};

const AddressIconTooltip = styled(Tooltip)`
  align-items: center;
  margin-right: ${space(0.75)};
`;

const AddressToggleIcon = styled(IconFilter)`
  cursor: pointer;
  visibility: hidden;
  display: none;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

const getAddresstextBorderBottom = (
  p: Pick<Partial<Props>, 'isFoundByStackScanning' | 'isInlineFrame'> & {theme: Theme}
) => {
  if (p.isFoundByStackScanning) {
    return `1px dashed ${p.theme.red300}`;
  }

  if (p.isInlineFrame) {
    return `1px dashed ${p.theme.blue300}`;
  }

  return 'none';
};

const Address = styled('span')<Partial<Props> & {canBeConverted: boolean}>`
  padding-left: ${p => (p.canBeConverted ? null : '18px')};
  border-bottom: ${getAddresstextBorderBottom};
  ${overflowEllipsis};
  max-width: 93px;
`;

const Wrapper = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray700};
  letter-spacing: -0.25px;
  width: 100%;
  flex-grow: 0;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 0 ${space(0.5)} 0 0;
  order: 1;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    padding: 0 ${space(0.5)};
    order: 0;
  }
`;

export default TogglableAddress;
export {AddressToggleIcon};

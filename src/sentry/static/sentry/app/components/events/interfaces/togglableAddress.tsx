import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {IconFilter} from 'app/icons';
import {formatAddress, parseAddress} from 'app/components/events/interfaces/utils';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {
  address: string;
  startingAddress: string | null;
  isAbsolute: boolean;
  onToggle?: () => void;
  isFoundByStackScanning: boolean;
  isInlineFrame: boolean;
  maxLengthOfRelativeAddress: number;
};

class TogglableAddress extends React.Component<Props> {
  convertAbsoluteAddressToRelative() {
    const {startingAddress, address, maxLengthOfRelativeAddress} = this.props;
    if (!startingAddress) {
      return '';
    }

    const relativeAddress = formatAddress(
      parseAddress(address) - parseAddress(startingAddress),
      maxLengthOfRelativeAddress
    );

    return `+${relativeAddress}`;
  }

  getAddressTooltip() {
    const {isInlineFrame, isFoundByStackScanning} = this.props;

    if (isInlineFrame && isFoundByStackScanning) {
      return t('Inline frame, found by stack scanning');
    }

    if (isInlineFrame) {
      return t('Inline frame');
    }

    if (isFoundByStackScanning) {
      return t('Found by stack scanning');
    }

    return null;
  }

  render() {
    const {
      address,
      isAbsolute,
      onToggle,
      isFoundByStackScanning,
      isInlineFrame,
    } = this.props;
    const relativeAddress = this.convertAbsoluteAddressToRelative();
    const canBeConverted = !!(onToggle && relativeAddress);

    const formattedAddress = !relativeAddress || isAbsolute ? address : relativeAddress;

    return (
      <Address>
        {canBeConverted && (
          <Tooltip title={isAbsolute ? t('Absolute') : t('Relative')}>
            <Toggle onClick={onToggle} size="xs" />
          </Tooltip>
        )}

        <Tooltip
          title={this.getAddressTooltip()}
          disabled={!(isFoundByStackScanning || isInlineFrame)}
        >
          <AddressText
            isFoundByStackScanning={isFoundByStackScanning}
            isInlineFrame={isInlineFrame}
            canBeConverted={canBeConverted}
          >
            {formattedAddress}
          </AddressText>
        </Tooltip>
      </Address>
    );
  }
}

const Toggle = styled(IconFilter)`
  opacity: 0.33;
  margin-right: 1ex;
  cursor: pointer;
  visibility: hidden;
  position: relative;
  top: 1px;
  display: none;

  &:hover {
    opacity: 1;
  }

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    display: inline;
  }
`;

const AddressText = styled('span')<Partial<Props> & {canBeConverted: boolean}>`
  border-bottom: ${p => {
    if (p.isFoundByStackScanning) {
      return `1px dashed ${p.theme.red400}`;
    } else if (p.isInlineFrame) {
      return `1px dashed ${p.theme.blue400}`;
    } else {
      return 'none';
    }
  }};
  padding-left: ${p => (p.canBeConverted ? null : '18px')};
`;

const Address = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray700};
  letter-spacing: -0.25px;
  width: 100%;
  flex-grow: 0;
  flex-shrink: 0;
  display: block;
  padding: 0 ${space(0.5)} 0 0;
  order: 1;

  &:hover ${Toggle} {
    visibility: visible;
  }

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    padding: 0 ${space(0.5)};
    width: 117px;
    order: 0;
  }
  ${overflowEllipsis}
`;

export default TogglableAddress;

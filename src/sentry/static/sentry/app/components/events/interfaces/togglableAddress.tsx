import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {formatAddress, parseAddress} from 'app/components/events/interfaces/utils';

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

    const formattedAddress = !relativeAddress || isAbsolute ? address : relativeAddress;

    return (
      <Address>
        {onToggle && relativeAddress && (
          <Tooltip title={isAbsolute ? t('Absolute') : t('Relative')}>
            <Toggle className="icon-filter" onClick={onToggle} />
          </Tooltip>
        )}

        <Tooltip
          title={this.getAddressTooltip()}
          disabled={!(isFoundByStackScanning || isInlineFrame)}
        >
          <AddressText
            isFoundByStackScanning={isFoundByStackScanning}
            isInlineFrame={isInlineFrame}
          >
            {formattedAddress}
          </AddressText>
        </Tooltip>
      </Address>
    );
  }
}

const Toggle = styled('span')`
  opacity: 0.33;
  margin-right: 1ex;
  cursor: pointer;
  visibility: hidden;
  position: relative;
  top: 1px;

  &:hover {
    opacity: 1;
  }
`;

const AddressText = styled('span')<Partial<Props>>`
  border-bottom: ${p => {
    if (p.isFoundByStackScanning) {
      return `1px dashed ${p.theme.red}`;
    } else if (p.isInlineFrame) {
      return `1px dashed ${p.theme.blue}`;
    } else {
      return 'none';
    }
  }};
`;

const Address = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.foreground};
  letter-spacing: -0.25px;
  width: 117px;
  flex-grow: 0;
  flex-shrink: 0;
  display: block;
  padding: 0 ${space(0.5)};

  &:hover ${Toggle} {
    visibility: visible;
  }
`;

export default TogglableAddress;

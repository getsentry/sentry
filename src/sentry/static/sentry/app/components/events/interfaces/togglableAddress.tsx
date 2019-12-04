import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {t} from 'app/locale';

type Props = {
  address: string;
  isAbsolute: boolean;
  onToggle?: () => void;
  isFoundByStackScanning: boolean;
  isInlineFrame: boolean;
};

class TogglableAddress extends React.Component<Props> {
  render() {
    const {
      address,
      isAbsolute,
      onToggle,
      isFoundByStackScanning,
      isInlineFrame,
    } = this.props;

    const formattedAddress = isAbsolute ? address : `+${'0x2a3d'}`; // TODO: compute relative address

    return (
      <Address>
        {onToggle && (
          <Tooltip
            title={isAbsolute ? t('Absolute') : t('Relative')}
            disabled={isInlineFrame}
          >
            <Toggle
              className="icon-filter"
              onClick={onToggle}
              invisible={isInlineFrame}
            />
          </Tooltip>
        )}

        <Tooltip title={t('Found by stack scanning')} disabled={!isFoundByStackScanning}>
          <AddressText isFoundByStackScanning={isFoundByStackScanning}>
            {isInlineFrame ? (
              <InlineAddressText>{t('inline')}</InlineAddressText>
            ) : (
              formattedAddress
            )}
          </AddressText>
        </Tooltip>
      </Address>
    );
  }
}

type ToggleProps = {
  invisible: boolean;
};
const Toggle = styled('span')<ToggleProps>`
  opacity: 0.33;
  margin-right: 1ex;
  cursor: pointer;
  visibility: hidden ${p => p.invisible && '!important'};

  &:hover {
    opacity: 1;
  }
`;

const AddressText = styled('span')<Partial<Props>>`
  border-bottom: ${p =>
    p.isFoundByStackScanning ? `1px dashed ${p.theme.red}` : 'none'};
`;

const InlineAddressText = styled('span')`
  opacity: 0.5;
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

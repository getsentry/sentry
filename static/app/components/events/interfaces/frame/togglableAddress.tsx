import * as React from 'react';
import styled from '@emotion/styled';

import {STACKTRACE_PREVIEW_TOOLTIP_DELAY} from 'app/components/stacktracePreview';
import Tooltip from 'app/components/tooltip';
import {IconFilter} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

import {formatAddress, parseAddress} from '../utils';

type Props = {
  address: string;
  startingAddress: string | null;
  isAbsolute: boolean;
  isFoundByStackScanning: boolean;
  isInlineFrame: boolean;
  relativeAddressMaxlength?: number;
  onToggle?: (event: React.MouseEvent<SVGElement>) => void;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
  className?: string;
};

function TogglableAddress({
  startingAddress,
  address,
  relativeAddressMaxlength,
  isInlineFrame,
  isFoundByStackScanning,
  isAbsolute,
  onToggle,
  isHoverPreviewed,
  className,
}: Props) {
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
  const canBeConverted = !!relativeAddress;
  const formattedAddress = !relativeAddress || isAbsolute ? address : relativeAddress;
  const tooltipTitle = getAddressTooltip();
  const tooltipDelay = isHoverPreviewed ? STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined;

  return (
    <Wrapper className={className}>
      {onToggle && canBeConverted && (
        <AddressIconTooltip
          title={isAbsolute ? t('Switch to relative') : t('Switch to absolute')}
          containerDisplayMode="inline-flex"
          delay={tooltipDelay}
        >
          <AddressToggleIcon onClick={onToggle} size="xs" color="purple300" />
        </AddressIconTooltip>
      )}
      <Tooltip
        title={tooltipTitle}
        disabled={!(isFoundByStackScanning || isInlineFrame)}
        delay={tooltipDelay}
      >
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
}

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
  border-bottom: ${getAddresstextBorderBottom};
  white-space: nowrap;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${p => (p.canBeConverted ? null : '18px')};
  }
`;

const Wrapper = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.textColor};
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

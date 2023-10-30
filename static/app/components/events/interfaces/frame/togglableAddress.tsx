import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {formatAddress, parseAddress} from '../utils';

type Props = {
  address: string;
  isAbsolute: boolean;
  isFoundByStackScanning: boolean;
  isInlineFrame: boolean;
  startingAddress: string | null;
  className?: string;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
  onToggle?: (event: React.MouseEvent<SVGElement>) => void;
  relativeAddressMaxlength?: number;
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
  const tooltipDelay = isHoverPreviewed ? SLOW_TOOLTIP_DELAY : undefined;

  return (
    <Wrapper className={className}>
      {onToggle && canBeConverted && (
        <AddressIconTooltip
          title={isAbsolute ? t('Switch to relative') : t('Switch to absolute')}
          containerDisplayMode="inline-flex"
          delay={tooltipDelay}
        >
          <AddressToggleIcon onClick={onToggle} size="xs" color="activeText" />
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
  @media (min-width: ${p => p.theme.breakpoints.small}) {
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

  @media (min-width: ${p => p.theme.breakpoints.small}) {
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

  @media (min-width: ${props => props.theme.breakpoints.small}) {
    padding: 0 ${space(0.5)};
    order: 0;
  }
`;

export default TogglableAddress;
export {AddressToggleIcon};

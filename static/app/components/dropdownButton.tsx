import styled from '@emotion/styled';

import {Chevron} from 'sentry/components/chevron';
import type {ButtonProps} from 'sentry/components/core/button';
import {Button, ButtonLabel} from 'sentry/components/core/button';
import {space} from 'sentry/styles/space';

export interface DropdownButtonProps extends Omit<ButtonProps, 'type' | 'prefix'> {
  /**
   * Whether or not the button should render as open
   */
  isOpen?: boolean;
  /**
   * The fixed prefix text to show in the button eg: 'Sort By'
   */
  prefix?: React.ReactNode;
  /**
   * Forward a ref to the button's root
   */
  ref?: React.Ref<HTMLButtonElement>;
  /**
   * Should a chevron icon be shown?
   */
  showChevron?: boolean;
}

function DropdownButton({
  children,
  prefix,
  size,
  isOpen = false,
  showChevron = true,
  disabled = false,
  ref,
  ...props
}: DropdownButtonProps) {
  return (
    <StyledButton
      aria-haspopup="true"
      aria-expanded={isOpen}
      hasPrefix={!!prefix}
      disabled={disabled}
      isOpen={isOpen}
      size={size}
      ref={ref}
      {...props}
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && (
        <ChevronWrap>
          <Chevron
            light
            color="subText"
            size={size === 'xs' ? 'small' : 'medium'}
            weight="medium"
            direction={isOpen ? 'up' : 'down'}
            aria-hidden="true"
          />
        </ChevronWrap>
      )}
    </StyledButton>
  );
}

const ChevronWrap = styled('div')`
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-left: ${space(0.5)};
  flex-shrink: 0;
`;

interface StyledButtonProps
  extends Required<Pick<DropdownButtonProps, 'isOpen' | 'disabled'>> {
  hasPrefix?: boolean;
}

const StyledButton = styled(Button)<StyledButtonProps>`
  position: relative;
  max-width: 100%;
  z-index: 2;

  ${p => (p.isOpen || p.disabled) && 'box-shadow: none;'}
  ${p => p.hasPrefix && `${ButtonLabel} {font-weight: ${p.theme.fontWeightNormal};}`}
`;

const LabelText = styled('span')`
  &:after {
    content: ':';
  }

  font-weight: ${p => p.theme.fontWeightBold};
  padding-right: ${space(0.75)};
`;

export default DropdownButton;

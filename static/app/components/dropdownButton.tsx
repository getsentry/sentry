import {forwardRef} from 'react';
import styled from '@emotion/styled';

import type {ButtonProps} from 'sentry/components/button';
import {Button, ButtonLabel} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {space} from 'sentry/styles/space';

export interface DropdownButtonProps extends Omit<ButtonProps, 'type' | 'prefix'> {
  /**
   * Forward a ref to the button's root
   */
  forwardedRef?: React.ForwardedRef<HTMLButtonElement>;
  /**
   * Whether or not the button should render as open
   */
  isOpen?: boolean;
  /**
   * The fixed prefix text to show in the button eg: 'Sort By'
   */
  prefix?: React.ReactNode;
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
  forwardedRef,
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
      ref={forwardedRef}
      {...props}
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && (
        <ChevronWrap>
          <Chevron
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

  button:hover & {
    opacity: 1;
  }
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

export default forwardRef<HTMLButtonElement, DropdownButtonProps>((props, ref) => (
  <DropdownButton forwardedRef={ref} {...props} />
));

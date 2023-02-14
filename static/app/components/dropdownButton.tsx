import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {Button, ButtonLabel, ButtonProps} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

export interface DropdownButtonProps extends Omit<ButtonProps, 'type' | 'prefix'> {
  /**
   * Forward a ref to the button's root
   */
  forwardedRef?: React.ForwardedRef<HTMLElement>;
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
      ref={forwardedRef}
      {...props}
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && (
        <StyledChevron size="xs" direction={isOpen ? 'up' : 'down'} aria-hidden="true" />
      )}
    </StyledButton>
  );
}

const StyledChevron = styled(IconChevron)`
  margin-left: ${space(0.75)};
  flex-shrink: 0;
`;

const StyledButton = styled(Button)<
  Required<Pick<DropdownButtonProps, 'isOpen' | 'disabled'>> & {
    hasPrefix: boolean;
  }
>`
  position: relative;
  max-width: 100%;
  z-index: 2;

  ${p => (p.isOpen || p.disabled) && 'box-shadow: none;'}
  ${p => p.hasPrefix && `${ButtonLabel} {font-weight: 400;}`}
`;

const LabelText = styled('span')`
  &:after {
    content: ':';
  }

  font-weight: 600;
  padding-right: ${space(0.75)};
`;

export default forwardRef<HTMLElement, DropdownButtonProps>((props, ref) => (
  <DropdownButton forwardedRef={ref} {...props} />
));

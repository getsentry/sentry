import * as React from 'react';
import styled from '@emotion/styled';

import Button, {ButtonProps} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import space from 'sentry/styles/space';

interface DropdownButtonProps extends Omit<ButtonProps, 'prefix'> {
  /**
   * Forward a ref to the button's root
   */
  forwardedRef?: React.Ref<typeof Button>;
  /**
   * Should the bottom border become transparent when open?
   */
  hideBottomBorder?: boolean;
  /**
   * Whether or not the button should render as open
   */
  isOpen?: boolean;
  /**
   * The fixed prefix text to show in the button eg: 'Sort By'
   */
  prefix?: React.ReactNode;
  /**
   * Button color
   */
  priority?: 'default' | 'primary' | 'form';
  /**
   * Should a chevron icon be shown?
   */
  showChevron?: boolean;
}

const DropdownButton = ({
  children,
  forwardedRef,
  prefix,
  isOpen = false,
  showChevron = false,
  hideBottomBorder = true,
  disabled = false,
  priority = 'form',
  ...props
}: DropdownButtonProps) => {
  return (
    <StyledButton
      {...props}
      type="button"
      aria-haspopup="listbox"
      disabled={disabled}
      priority={priority}
      isOpen={isOpen}
      hideBottomBorder={hideBottomBorder}
      ref={forwardedRef}
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && <StyledChevron size="xs" direction={isOpen ? 'up' : 'down'} />}
    </StyledButton>
  );
};

DropdownButton.defaultProps = {
  showChevron: true,
};

const StyledChevron = styled(IconChevron)`
  margin-left: 0.33em;
`;

const StyledButton = styled(Button)<
  Required<
    Pick<DropdownButtonProps, 'isOpen' | 'disabled' | 'hideBottomBorder' | 'priority'>
  >
>`
  border-bottom-right-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  border-bottom-left-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index: 2;
  box-shadow: ${p => (p.isOpen || p.disabled ? 'none' : p.theme.dropShadowLight)};
  &,
  &:active,
  &:focus,
  &:hover {
    border-bottom-color: ${p =>
      p.isOpen && p.hideBottomBorder
        ? 'transparent'
        : p.theme.button[p.priority].borderActive};
  }
`;

const LabelText = styled('span')`
  font-weight: 400;
  padding-right: ${space(0.75)};
  &:after {
    content: ':';
  }
`;

export default React.forwardRef<typeof Button, DropdownButtonProps>((props, ref) => (
  <DropdownButton forwardedRef={ref} {...props} />
));

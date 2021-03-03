import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

type Props = Omit<React.ComponentProps<typeof Button>, 'type' | 'priority'> & {
  /**
   * The fixed prefix text to show in the button eg: 'Sort By'
   */
  prefix?: React.ReactNode;
  /**
   * Whether or not the button should render as open
   */
  isOpen?: boolean;
  /**
   * Should a chevron icon be shown?
   */
  showChevron?: boolean;
  /**
   * Should the bottom border become transparent when open?
   */
  hideBottomBorder?: boolean;
  /**
   * Button color
   */
  priority?: 'default' | 'primary' | 'form';
  /**
   * Forward a ref to the button's root
   */
  forwardedRef?: React.Ref<typeof Button>;
};

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
}: Props) => {
  return (
    <StyledButton
      {...props}
      type="button"
      disabled={disabled}
      priority={priority}
      isOpen={isOpen}
      hideBottomBorder={hideBottomBorder}
      ref={forwardedRef}
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && <StyledChevron size="10px" direction={isOpen ? 'up' : 'down'} />}
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
  Required<Pick<Props, 'isOpen' | 'disabled' | 'hideBottomBorder' | 'priority'>>
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
  &:after {
    content: ':';
  }

  font-weight: 400;
  padding-right: ${space(0.75)};
`;

export default React.forwardRef<typeof Button, Props>((props, ref) => (
  <DropdownButton forwardedRef={ref} {...props} />
));

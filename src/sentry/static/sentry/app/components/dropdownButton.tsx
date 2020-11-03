import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import space from 'app/styles/space';
import {IconChevron} from 'app/icons';

type Props = React.ComponentProps<typeof Button> & {
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
  forwardedRef?: React.Ref<typeof Button>;
};

const DropdownButton = ({
  isOpen,
  children,
  forwardedRef,
  prefix,
  showChevron = false,
  hideBottomBorder = true,
  ...props
}: Props) => (
  <StyledButton
    type="button"
    isOpen={isOpen}
    hideBottomBorder={hideBottomBorder}
    ref={forwardedRef}
    {...props}
  >
    {prefix && <LabelText>{prefix}:</LabelText>}
    {children}
    {showChevron && <StyledChevron size="10px" direction={isOpen ? 'up' : 'down'} />}
  </StyledButton>
);

DropdownButton.defaultProps = {
  showChevron: true,
};

const StyledChevron = styled(IconChevron)`
  margin-left: 0.33em;
`;

const StyledButton = styled(Button)<
  Pick<Props, 'isOpen' | 'disabled' | 'hideBottomBorder'>
>`
  border-bottom-right-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  border-bottom-left-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index: 2;
  box-shadow: ${p => (p.isOpen || p.disabled ? 'none' : p.theme.dropShadowLight)};
  border-bottom-color: ${p =>
    p.isOpen && p.hideBottomBorder ? 'transparent' : p.theme.border};

  &:active,
  &:focus,
  &:hover {
    border-bottom-color: ${p =>
      p.isOpen && p.hideBottomBorder ? 'transparent' : p.theme.border};
  }
`;

const LabelText = styled('em')`
  font-style: normal;
  color: ${p => p.theme.gray500};
  padding-right: ${space(0.75)};
`;

export default React.forwardRef<typeof Button, Props>((props, ref) => (
  <DropdownButton forwardedRef={ref} {...props} />
));

import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';

type Props = React.ComponentProps<typeof Button> & {
  isOpen?: boolean;
  showChevron?: boolean;
  forwardedRef?: React.Ref<typeof Button>;
};

const DropdownButton = ({
  isOpen,
  children,
  forwardedRef,
  showChevron = false,
  ...props
}: Props) => (
  <StyledButton type="button" isOpen={isOpen} ref={forwardedRef} {...props}>
    {children}
    {showChevron && <StyledChevronDown />}
  </StyledButton>
);

DropdownButton.defaultProps = {
  showChevron: true,
};

const StyledChevronDown = styled(props => (
  <InlineSvg src="icon-chevron-down" {...props} />
))`
  margin-left: 0.33em;
`;

const StyledButton = styled(Button)<Pick<Props, 'isOpen' | 'disabled'>>`
  border-bottom-right-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  border-bottom-left-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index: 2;
  box-shadow: ${p => (p.isOpen || p.disabled ? 'none' : p.theme.dropShadowLight)};
  border-bottom-color: ${p => (p.isOpen ? 'transparent' : p.theme.borderDark)};

  &:active,
  &:focus,
  &:hover {
    border-bottom-color: ${p => (p.isOpen ? 'transparent' : p.theme.borderDark)};
  }
`;

export default React.forwardRef<typeof Button, Props>((props, ref) => (
  <DropdownButton forwardedRef={ref} {...props} />
));

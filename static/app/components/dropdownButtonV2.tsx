import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import space from 'sentry/styles/space';

export type DropdownButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  'type' | 'priority'
> & {
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
  disabled = false,
  priority = 'form',
  ...props
}: DropdownButtonProps) => {
  return (
    <StyledButton
      {...props}
      type="button"
      disabled={disabled}
      priority={priority}
      isOpen={isOpen}
      ref={forwardedRef}
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && (
        <StyledChevron
          size="10px"
          direction={isOpen ? 'up' : 'down'}
          aria-hidden="true"
        />
      )}
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
  Required<Pick<DropdownButtonProps, 'isOpen' | 'disabled' | 'priority'>>
>`
  position: relative;
  z-index: 2;

  ${p => p.isOpen || (p.disabled && 'box-shadow: none;')}
`;

const LabelText = styled('span')`
  &:after {
    content: ':';
  }

  font-weight: 400;
  padding-right: ${space(0.75)};
`;

export default React.forwardRef<typeof Button, DropdownButtonProps>((props, ref) => (
  <DropdownButton forwardedRef={ref} {...props} />
));

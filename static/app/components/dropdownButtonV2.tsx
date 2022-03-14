import {forwardRef} from 'react';
import styled from '@emotion/styled';

import Button, {ButtonProps} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import space from 'sentry/styles/space';

export type DropdownButtonProps = {
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
} & Omit<ButtonProps, 'type' | 'prefix'>;

const DropdownButton = forwardRef<
  React.RefObject<HTMLElement> | null,
  DropdownButtonProps
>(
  (
    {
      children,
      prefix,
      isOpen = false,
      showChevron = true,
      disabled = false,
      priority = 'form',
      ...props
    }: DropdownButtonProps,
    ref
  ) => (
    <StyledButton
      {...props}
      type="button"
      disabled={disabled}
      priority={priority}
      isOpen={isOpen}
      ref={ref}
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
  )
);

const StyledChevron = styled(IconChevron)`
  margin-left: ${space(0.75)};
`;

const StyledButton = styled(Button)<
  Required<Pick<DropdownButtonProps, 'isOpen' | 'disabled' | 'priority'>>
>`
  position: relative;
  z-index: 2;

  ${p => (p.isOpen || p.disabled) && 'box-shadow: none;'}
`;

const LabelText = styled('span')`
  &:after {
    content: ':';
  }

  font-weight: 400;
  padding-right: ${space(0.75)};
`;

export default DropdownButton;

import {forwardRef} from 'react';
import styled from '@emotion/styled';

import Button, {ButtonLabel, ButtonProps} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import space from 'sentry/styles/space';

interface DropdownButtonProps extends Omit<ButtonProps, 'prefix'> {
  /**
   * Whether the menu associated with this button is visually detached.
   */
  detached?: boolean;
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
   * Align chevron to the right of dropdown button
   */
  rightAlignChevron?: boolean;
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
  detached = false,
  disabled = false,
  priority = 'form',
  rightAlignChevron = false,
  ...props
}: DropdownButtonProps) => {
  return (
    <StyledButton
      {...props}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={detached ? isOpen : undefined}
      hasPrefix={!!prefix}
      disabled={disabled}
      priority={priority}
      isOpen={isOpen}
      hideBottomBorder={hideBottomBorder}
      detached={detached}
      ref={forwardedRef}
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && (
        <StyledChevron
          rightAlignChevron={rightAlignChevron}
          size="xs"
          direction={isOpen ? 'up' : 'down'}
        />
      )}
    </StyledButton>
  );
};

DropdownButton.defaultProps = {
  showChevron: true,
};

const StyledChevron = styled(IconChevron, {
  shouldForwardProp: prop => prop !== 'rightAlignChevron',
})<{
  rightAlignChevron: boolean;
}>`
  margin-left: 0.33em;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    position: ${p => p.rightAlignChevron && 'absolute'};
    right: ${p => p.rightAlignChevron && `${space(2)}`};
  }
`;

const StyledButton = styled(Button)<
  Required<
    Pick<
      DropdownButtonProps,
      'isOpen' | 'disabled' | 'hideBottomBorder' | 'detached' | 'priority'
    >
  > & {
    hasPrefix: boolean;
  }
>`
  border-bottom-right-radius: ${p =>
    p.isOpen && !p.detached ? 0 : p.theme.borderRadius};
  border-bottom-left-radius: ${p => (p.isOpen && !p.detached ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index: 2;

  ${p => (p.isOpen || p.disabled) && 'box-shadow: none'};
  ${p => p.hasPrefix && `${ButtonLabel} {font-weight: 400;}`}

  &,
  &:active,
  &:focus,
  &:hover {
    ${p =>
      p.isOpen &&
      p.hideBottomBorder &&
      !p.detached &&
      `border-bottom-color: transparent;`}
  }
`;

const LabelText = styled('span')`
  font-weight: 600;
  padding-right: ${space(0.75)};
  &:after {
    content: ':';
  }
`;

export default forwardRef<typeof Button, DropdownButtonProps>((props, ref) => (
  <DropdownButton forwardedRef={ref} {...props} />
));

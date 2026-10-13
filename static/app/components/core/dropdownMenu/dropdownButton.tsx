import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import {IconChevron} from '@sentry/icons/chevron';
import type {DistributedOmit} from 'type-fest';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

export type DropdownButtonProps = DistributedOmit<ButtonProps, 'type' | 'prefix'> & {
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
};

export function DropdownButton({
  children,
  prefix,
  size,
  isOpen = false,
  showChevron = true,
  disabled = false,
  ref,
  onClick,
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
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onClick?.(event);
      }}
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && (
        <ChevronWrap>
          <IconChevron
            variant={(props.variant ?? 'secondary') === 'secondary' ? 'muted' : undefined}
            direction={isOpen ? 'up' : 'down'}
            size={size === 'zero' || size === 'xs' ? 'xs' : 'sm'}
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
  padding-left: ${p => p.theme.space.xs};
  flex-shrink: 0;
`;

interface StyledButtonProps extends Required<
  Pick<DropdownButtonProps, 'isOpen' | 'disabled'>
> {
  hasPrefix?: boolean;
}

const StyledButton = styled(Button)<StyledButtonProps>`
  position: relative;
  max-width: 100%;

  ${p =>
    (p.isOpen || p.disabled) &&
    css`
      box-shadow: none;
    `}
  ${p =>
    p.hasPrefix &&
    css`
      font-weight: ${p.theme.font.weight.sans.regular};
    `}
`;

const LabelText = styled('span')`
  &:after {
    content: ':';
  }

  font-weight: ${p => p.theme.font.weight.sans.medium};
  padding-right: ${p => p.theme.space.sm};
`;

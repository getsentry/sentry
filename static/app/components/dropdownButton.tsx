import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

export type DropdownButtonProps = DistributedOmit<
  ButtonProps,
  'type' | 'prefix' | 'onClick'
> & {
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

function DropdownButton({
  children,
  prefix,
  size,
  isOpen = false,
  showChevron = true,
  disabled = false,
  ref,
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
    >
      {prefix && <LabelText>{prefix}</LabelText>}
      {children}
      {showChevron && (
        <ChevronWrap>
          <IconChevron
            color={
              !props.priority || props.priority === 'default' ? 'subText' : undefined
            }
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
  padding-left: ${space(0.5)};
  flex-shrink: 0;
`;

interface StyledButtonProps
  extends Required<Pick<DropdownButtonProps, 'isOpen' | 'disabled'>> {
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
      font-weight: ${p.theme.fontWeight.normal};
    `}
`;

const LabelText = styled('span')`
  &:after {
    content: ':';
  }

  font-weight: ${p => p.theme.fontWeight.bold};
  padding-right: ${space(0.75)};
`;

export default DropdownButton;

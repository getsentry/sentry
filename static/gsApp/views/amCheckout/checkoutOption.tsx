import {css} from '@emotion/react';
import styled from '@emotion/styled';

function CheckoutOption({
  children,
  isSelected,
  onClick,
  dataTestId,
  ariaLabel,
  ariaRole,
}: {
  ariaLabel: string;
  ariaRole: 'radio' | 'checkbox';
  children: React.ReactNode;
  dataTestId: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Option
      role={ariaRole}
      aria-checked={isSelected}
      isSelected={isSelected}
      onClick={onClick}
      data-test-id={dataTestId}
      aria-label={ariaLabel}
    >
      {children}
    </Option>
  );
}

export default CheckoutOption;

const Option = styled('div')<{isSelected: boolean}>`
  width: 100%;
  color: ${p => p.theme.textColor};
  cursor: pointer;
  position: relative;

  &:before,
  &:after {
    content: '';
    display: block;
    position: absolute;
    inset: 0;
  }

  &::before {
    height: calc(100% - ${p => p.theme.space['2xs']});
    background: ${p => (p.isSelected ? p.theme.tokens.graphics.accent : p.theme.border)};
    border-radius: ${p => p.theme.borderRadius};
  }

  &::after {
    background: ${p => p.theme.background};
    border-radius: ${p => p.theme.borderRadius};
    border: 1px solid
      ${p => (p.isSelected ? p.theme.tokens.graphics.accent : p.theme.border)};
  }

  > * {
    z-index: 1;
    position: relative;
  }

  ${p =>
    p.theme.isChonk &&
    css`
      &::before {
        top: ${p.theme.space['2xs']};
        transform: translateY(-${p.theme.space['2xs']});
        box-shadow: 0 ${p.theme.space['2xs']} 0 0px
          ${p.isSelected ? p.theme.tokens.graphics.accent : p.theme.border};
      }

      &::after {
        transform: ${p.isSelected
          ? 'translateY(0)'
          : `translateY(-${p.theme.space['2xs']})`};
        transition: transform 0.06s ease-in;
      }

      > * {
        transform: ${p.isSelected
          ? 'translateY(0)'
          : `translateY(-${p.theme.space['2xs']})`};
        transition: transform 0.06s ease-in;
      }

      &:hover {
        &::after,
        > * {
          transform: ${p.isSelected
            ? 'translateY(0)'
            : `translateY(calc(-${p.theme.space['2xs']} - 2px))`};
        }
      }

      &:active,
      &[aria-expanded='true'],
      &[aria-checked='true'] {
        &::after,
        > * {
          transform: translateY(0);
        }
      }

      &:disabled,
      &[aria-disabled='true'] {
        &::after,
        > * {
          transform: translateY(0px);
        }
      }
    `}
`;

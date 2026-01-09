import styled from '@emotion/styled';

// TODO(isabella): Instead of requiring the code using this component to
// render the radio/checkbox, we should just render the radio/checkbox directly
// depending on ariaRole
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
      tabIndex={0}
      role={ariaRole}
      aria-checked={isSelected}
      isSelected={isSelected}
      onClick={onClick}
      data-test-id={dataTestId}
      aria-label={ariaLabel}
      onKeyDown={({key}) => {
        if (key === 'Enter') {
          onClick();
        }
      }}
    >
      {children}
    </Option>
  );
}

export default CheckoutOption;

const Option = styled('div')<{isSelected: boolean}>`
  width: 100%;
  color: ${p => p.theme.tokens.content.primary};
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
    background: ${p =>
      p.isSelected ? p.theme.tokens.graphics.accent : p.theme.tokens.border.primary};
    border-radius: ${p => p.theme.radius.md};
    top: ${p => p.theme.space['2xs']};
    transform: translateY(-${p => p.theme.space['2xs']});
    box-shadow: 0 ${p => p.theme.space['2xs']} 0 0px
      ${p =>
        p.isSelected ? p.theme.tokens.graphics.accent : p.theme.tokens.border.primary};
  }

  &::after {
    background: ${p => p.theme.tokens.background.primary};
    border-radius: ${p => p.theme.radius.md};
    border: 1px solid
      ${p =>
        p.isSelected ? p.theme.tokens.graphics.accent : p.theme.tokens.border.primary};
    transform: ${p =>
      p.isSelected ? 'translateY(0)' : `translateY(-${p.theme.space['2xs']})`};
    transition: transform 0.06s ease-in;
  }

  > * {
    z-index: 1;
    position: relative;
    transform: ${p =>
      p.isSelected ? 'translateY(0)' : `translateY(-${p.theme.space['2xs']})`};
    transition: transform 0.06s ease-in;
  }

  &:hover {
    &::after,
    > * {
      transform: ${p =>
        p.isSelected
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
`;

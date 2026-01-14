import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';

function CheckoutOption({
  isSelected,
  onClick,
  dataTestId,
  ariaLabel,
  ariaRole,
  topDecoration,
  optionHeader,
  optionDescription,
  withDivider,
}: {
  ariaLabel: string;
  ariaRole: 'radio' | 'checkbox';
  dataTestId: string;
  isSelected: boolean;
  onClick: () => void;
  optionHeader: React.ReactNode;
  optionDescription?: React.ReactNode;
  topDecoration?: React.ReactNode;
  withDivider?: boolean;
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
      <Flex direction="column" padding="xl" gap="lg">
        {!!topDecoration && topDecoration}
        <Flex align="start" justify="between" gap="md">
          <Container paddingTop="2xs">
            {ariaRole === 'radio' ? (
              <RadioMarker isSelected={isSelected} />
            ) : (
              <Checkbox
                tabIndex={-1} // let parent handle the focus
                aria-label={ariaLabel}
                aria-checked={isSelected}
                checked={isSelected}
                onChange={onClick}
              />
            )}
          </Container>
          <Flex direction="column" gap="sm" flexGrow={1}>
            {optionHeader}
            {/* If there is no divider, line the description up with the header */}
            {!withDivider && !!optionDescription && optionDescription}
          </Flex>
        </Flex>
        {withDivider && (
          <Fragment>
            <Separator orientation="horizontal" border="primary" />
            {/* If there is a divider, line the description up with the radio/checkbox */}
            {!!optionDescription && optionDescription}
          </Fragment>
        )}
      </Flex>
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

const RadioMarker = styled('div')<{isSelected?: boolean}>`
  width: ${p => p.theme.space.xl};
  height: ${p => p.theme.space.xl};
  border-radius: ${p => p.theme.space['3xl']};
  background: ${p => p.theme.tokens.background.primary};
  border-color: ${p =>
    p.isSelected ? p.theme.tokens.border.accent : p.theme.tokens.border.primary};
  border-width: ${p => (p.isSelected ? '4px' : '1px')};
  border-style: solid;
`;

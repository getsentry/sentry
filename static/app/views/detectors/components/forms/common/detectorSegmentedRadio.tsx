import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Grid, Stack, type StackProps} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

interface Props<Value extends string> extends Omit<
  React.ComponentProps<typeof Radio>,
  'value' | 'onChange' | 'checked'
> {
  onChange: (value: Value) => void;
  options: ReadonlyArray<{label: string; value: Value; description?: string}>;
  value: Value;
}

export function DetectorSegmentedRadio<Value extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  ...inputProps
}: Props<Value>) {
  return (
    <Grid
      flow={{zero: 'row', xl: 'column'}}
      autoColumns="minmax(0, 1fr)"
      autoRows="minmax(0, 1fr)"
      width="100%"
      maxWidth={{zero: '100%', xl: '824px'}}
      overflow="hidden"
      radius="md"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map(option => (
        <Segment
          as="label"
          key={option.value}
          gap="xs"
          position="relative"
          padding="md lg"
          border="primary"
          aria-checked={value === option.value}
          aria-disabled={inputProps.disabled}
          cursor={inputProps.disabled ? 'not-allowed' : 'pointer'}
        >
          <InteractionStateLayer />
          <VisuallyHidden>
            <Radio
              {...inputProps}
              id={`${inputProps.id}-${option.value}`}
              value={option.value}
              aria-label={option.label}
              aria-describedby={
                option.description
                  ? `${inputProps.id}-${option.value}-description`
                  : undefined
              }
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
          </VisuallyHidden>
          <Text bold>{option.label}</Text>
          {option.description && (
            <Text
              id={`${inputProps.id}-${option.value}-description`}
              size="sm"
              variant="muted"
              bold={false}
              density="comfortable"
            >
              {option.description}
            </Text>
          )}
        </Segment>
      ))}
    </Grid>
  );
}

const Segment = styled((props: StackProps<'label'>) => <Stack {...props} />)`
  margin: 0;

  &[aria-checked='true'] {
    border-color: ${p => p.theme.tokens.border.accent.vibrant} !important;
    box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.focus.default};
    z-index: ${p => p.theme.zIndex.initial};
  }

  &:has(input:focus-visible) {
    ${p => p.theme.focusRing()};
  }

  &:first-child {
    border-top-left-radius: ${p => p.theme.radius.md};
    border-top-right-radius: ${p => p.theme.radius.md};
  }

  &:last-child {
    border-bottom-left-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
  }

  &:nth-child(n + 2) {
    border-top-color: transparent;
  }

  @container (min-width: ${p => p.theme.container.xl}) {
    &:nth-child(n + 2) {
      border-top-color: ${p => p.theme.tokens.border.primary};
      border-left-color: transparent;
    }

    &:first-child {
      border-top-right-radius: 0;
      border-bottom-left-radius: ${p => p.theme.radius.md};
    }

    &:last-child {
      border-bottom-left-radius: 0;
      border-top-right-radius: ${p => p.theme.radius.md};
    }
  }
`;

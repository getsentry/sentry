import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Radio} from 'sentry/components/core/radio';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import type {InputFieldProps, OnEvent} from 'sentry/components/forms/fields/inputField';
import FormField from 'sentry/components/forms/formField';
import {space} from 'sentry/styles/space';

interface SegmentedRadioFieldProps<Choices extends string = string>
  extends Omit<InputFieldProps, 'type'> {
  choices?: RadioGroupProps<Choices>['choices'];
}

function handleChange(
  id: string,
  onChange: OnEvent,
  onBlur: OnEvent,
  e: React.FormEvent<HTMLInputElement>
) {
  onChange(id, e);
  onBlur(id, e);
}

function SegmentedRadioField<Choices extends string = string>(
  props: SegmentedRadioFieldProps<Choices>
) {
  return (
    <FormField {...props}>
      {({id, onChange, onBlur, value, disabled, ...fieldProps}) => (
        <RadioControlGroup
          id={id}
          name={props.name}
          choices={fieldProps.choices}
          disabled={disabled}
          label={fieldProps.label}
          value={value === '' ? null : value}
          onChange={(v, e) => handleChange(v, onChange, onBlur, e)}
        />
      )}
    </FormField>
  );
}

function RadioControlGroup<C extends string>({
  name: groupName,
  value,
  disabled: groupDisabled,
  disabledChoices = [],
  choices = [],
  label,
  onChange,
  tooltipPosition,
  ...props
}: RadioGroupProps<C>) {
  return (
    <Container {...props} role="radiogroup" aria-label={label}>
      {choices.map(([id, name, description], index) => {
        const disabledChoice = disabledChoices.find(([choiceId]) => choiceId === id);
        const disabledChoiceReason = disabledChoice?.[1];
        const disabled = !!disabledChoice || groupDisabled;

        return (
          <Tooltip
            key={index}
            disabled={!disabledChoiceReason}
            title={disabledChoiceReason}
            position={tooltipPosition}
          >
            <RadioItem index={index} aria-checked={value === id} disabled={disabled}>
              <InteractionStateLayer />
              <Radio
                name={groupName}
                aria-label={name?.toString()} // eslint-disable-line @typescript-eslint/no-base-to-string
                disabled={disabled}
                checked={value === id}
                onChange={(e: React.FormEvent<HTMLInputElement>) =>
                  !disabled && onChange(id, e)
                }
              />
              <RadioLineText disabled={disabled}>{name}</RadioLineText>
              {description && <Description>{description}</Description>}
            </RadioItem>
          </Tooltip>
        );
      })}
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-auto-flow: row;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-rows: minmax(0, 1fr);
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-auto-flow: column;
  }
  overflow: hidden;
  border-radius: ${p => p.theme.radius.md};
`;

const shouldForwardProp = (p: PropertyKey) =>
  typeof p === 'string' && !['disabled', 'animate'].includes(p) && isPropValid(p);

const RadioItem = styled('label', {shouldForwardProp})<{
  index: number;
  disabled?: boolean;
}>`
  position: relative;
  padding: ${space(1)} ${space(1.5)};
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  outline: none;
  font-weight: ${p => p.theme.fontWeight.normal};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  margin: 0;

  &[aria-checked='true'] {
    border-color: ${p => p.theme.tokens.border.accent.vibrant} !important;
    box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.border.accent.vibrant};
    z-index: ${p => p.theme.zIndex.initial};
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

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    &:nth-child(n + 2) {
      border-top-color: ${p => p.theme.colors.gray200};
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

  input {
    /* visually hidden */
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }
`;

const RadioLineText = styled('div', {shouldForwardProp})<{disabled?: boolean}>`
  opacity: ${p => (p.disabled ? 0.4 : null)};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.colors.gray800};
`;

const Description = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.4em;
`;

export default SegmentedRadioField;

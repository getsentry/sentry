import {useId} from 'react';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import type {InputFieldProps, OnEvent} from 'sentry/components/forms/fields/inputField';
import {FormField} from 'sentry/components/forms/formField';

interface SegmentedRadioFieldProps<Choices extends string = string> extends Omit<
  InputFieldProps,
  'type'
> {
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

export function SegmentedRadioField<Choices extends string = string>(
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
  choices,
  label,
  onChange,
  tooltipPosition,
  ...props
}: RadioGroupProps<C>) {
  const groupId = useId();

  return (
    <Grid
      {...props}
      flow={{zero: 'row', xl: 'column'}}
      autoColumns="minmax(0, 1fr)"
      autoRows="minmax(0, 1fr)"
      gap="md"
      role="radiogroup"
      aria-label={label}
    >
      {choices.map(([id, name, description]) => {
        const disabledChoice = disabledChoices.find(([choiceId]) => choiceId === id);
        const disabledChoiceReason = disabledChoice?.[1];
        const disabled = !!disabledChoice || groupDisabled;
        const labelId = `${groupId}-${id}-label`;
        const descriptionId = `${groupId}-${id}-description`;

        return (
          <Tooltip
            key={id}
            disabled={!disabledChoiceReason}
            title={disabledChoiceReason}
            position={tooltipPosition}
          >
            <ToggleCard
              variant="radio"
              padding="md lg"
              name={groupName ?? groupId}
              value={id}
              aria-labelledby={labelId}
              aria-describedby={description ? descriptionId : undefined}
              disabled={disabled}
              checked={value === id}
              onChange={e => onChange(id, e)}
            >
              <Stack gap="2xs">
                <Text id={labelId} bold>
                  {name}
                </Text>
                {description && (
                  <Text id={descriptionId} variant="secondary" size="sm">
                    {description}
                  </Text>
                )}
              </Stack>
            </ToggleCard>
          </Tooltip>
        );
      })}
    </Grid>
  );
}

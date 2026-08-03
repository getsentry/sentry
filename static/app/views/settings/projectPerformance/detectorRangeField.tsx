import type {ReactNode} from 'react';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  type CommonDetectorFieldProps,
  useDetectorFieldMutationOptions,
} from './detectorField';

export type DetectorRangeFieldProps = Omit<CommonDetectorFieldProps, 'initialValue'> & {
  allowedValues: readonly number[];
  initialValue: number;
  formatLabel?: (value: number | '') => ReactNode;
  showTickLabels?: boolean;
  tickValues?: number[];
};

export function DetectorRangeField({
  allowedValues,
  disabled,
  endpoint,
  formatLabel,
  help,
  initialValue,
  label,
  name,
  projectSlug,
  showTickLabels,
  tickValues,
}: DetectorRangeFieldProps) {
  const mutationOptions = useDetectorFieldMutationOptions(endpoint, projectSlug);

  return (
    <AutoSaveForm
      name={name}
      schema={z.object({[name]: z.number()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {field => {
        const valueIndex = Math.max(allowedValues.indexOf(field.state.value), 0);
        const formattedValue = formatLabel?.(field.state.value);

        return (
          <field.Layout.Row label={label} hintText={help}>
            <Stack flexGrow={1} gap="xs">
              <field.Range
                aria-label={label}
                value={valueIndex}
                onChange={index => {
                  const value = allowedValues[index];
                  if (value !== undefined) {
                    field.handleChange(value);
                  }
                }}
                min={0}
                max={Math.max(allowedValues.length - 1, 0)}
                step={1}
                ticks={
                  tickValues ? {values: tickValues, labels: showTickLabels} : undefined
                }
                formatOptions="hidden"
                aria-valuetext={
                  typeof formattedValue === 'string' ? formattedValue : undefined
                }
                disabled={disabled}
              />
              <Text align="right" size="sm" variant="muted">
                {formattedValue ?? field.state.value}
              </Text>
            </Stack>
          </field.Layout.Row>
        );
      }}
    </AutoSaveForm>
  );
}

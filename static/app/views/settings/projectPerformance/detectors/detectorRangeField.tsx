import {memo, type ReactNode} from 'react';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {CommonDetectorFieldProps} from './detectorField';
import {useDetectorFieldMutationOptions} from './useDetectorFieldMutationOptions';

export type DetectorRangeFieldProps = CommonDetectorFieldProps & {
  allowedValues: readonly number[];
  initialValue: number;
  formatLabel?: (value: number | '') => ReactNode;
  showTickLabels?: boolean;
  tickValues?: number[];
};

/**
 * Every detector save updates the shared settings query, which rebuilds all
 * detector fields with freshly sliced `allowedValues`/`tickValues` arrays.
 * Compare arrays by value so only the field that changed re-renders.
 */
function arePropsEqual(prev: DetectorRangeFieldProps, next: DetectorRangeFieldProps) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<
    keyof DetectorRangeFieldProps
  >;
  return [...keys].every(key => {
    const prevValue = prev[key];
    const nextValue = next[key];
    if (Array.isArray(prevValue) && Array.isArray(nextValue)) {
      return (
        prevValue.length === nextValue.length &&
        prevValue.every((value, index) => value === nextValue[index])
      );
    }
    return Object.is(prevValue, nextValue);
  });
}

export const DetectorRangeField = memo(function DetectorRangeField({
  allowedValues,
  disabled,
  formatLabel,
  help,
  initialValue,
  label,
  name,
  projectSlug,
  showTickLabels,
  tickValues,
}: DetectorRangeFieldProps) {
  const mutationOptions = useDetectorFieldMutationOptions({projectSlug});

  return (
    <AutoSaveForm
      name={name}
      schema={z.object({[name]: z.number()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {field => {
        const rangeValues = allowedValues.includes(field.state.value)
          ? allowedValues
          : [...allowedValues, field.state.value].sort((a, b) => a - b);
        const valueIndex = rangeValues.indexOf(field.state.value);
        const rangeTickValues = tickValues?.map(index => {
          const tickValue = allowedValues[index];
          return tickValue === undefined ? index : rangeValues.indexOf(tickValue);
        });
        const formattedValue = formatLabel?.(field.state.value);

        return (
          <field.Layout.Row label={label} hintText={help}>
            <Stack flexGrow={1} gap="xs">
              <field.Range
                aria-label={label}
                value={valueIndex}
                onChange={index => {
                  const value = rangeValues[index];
                  if (value !== undefined) {
                    field.handleChange(value);
                  }
                }}
                min={0}
                max={Math.max(rangeValues.length - 1, 0)}
                step={1}
                ticks={
                  rangeTickValues
                    ? {values: rangeTickValues, labels: showTickLabels}
                    : undefined
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
}, arePropsEqual);

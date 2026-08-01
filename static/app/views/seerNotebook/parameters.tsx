import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useProjects} from 'sentry/utils/useProjects';

import type {InvestigationParameter} from './types';

type Props = {
  disabled: boolean;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  parameters: InvestigationParameter[];
};

export function InvestigationParameters({disabled, parameters, onSave}: Props) {
  const {projects} = useProjects();
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        parameters.map(parameter => [
          parameter.key,
          parameter.savedValue ?? parameter.defaultValue,
        ])
      ),
    [parameters]
  );
  const [values, setValues] = useState(initialValues);
  const [saveError, setSaveError] = useState<string>();
  const debouncedValues = useDebouncedValue(values, 600);
  const lastServerValue = useRef(JSON.stringify(initialValues));
  const onSaveRef = useRef(onSave);
  const errors = useMemo(
    () => getParameterErrors(parameters, values),
    [parameters, values]
  );
  const projectOptions = projects.map(project => ({
    label: project.slug,
    value: project.id,
  }));

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const serialized = JSON.stringify(initialValues);
    lastServerValue.current = serialized;
    setValues(initialValues);
  }, [initialValues]);

  const saveValues = useCallback(
    (nextValues: Record<string, unknown>) => {
      const serialized = JSON.stringify(nextValues);
      if (
        disabled ||
        serialized === lastServerValue.current ||
        Object.keys(getParameterErrors(parameters, nextValues)).length > 0
      ) {
        return;
      }

      const previousServerValue = lastServerValue.current;
      lastServerValue.current = serialized;
      onSaveRef
        .current(nextValues)
        .then(() => setSaveError(undefined))
        .catch(() => {
          lastServerValue.current = previousServerValue;
          setSaveError(t('Some parameter values could not be saved.'));
        });
    },
    [disabled, parameters]
  );

  useEffect(() => {
    if (disabled) {
      return;
    }
    saveValues(debouncedValues);
  }, [debouncedValues, disabled, saveValues]);

  if (parameters.length === 0) {
    return null;
  }

  const update = (key: string, value: unknown) =>
    setValues(current => ({...current, [key]: value}));

  return (
    <ParameterSection onBlur={() => saveValues(values)}>
      {parameters.map(parameter => {
        const value = values[parameter.key];
        const options = Array.isArray(parameter.constraints.options)
          ? parameter.constraints.options.map(option => ({
              label: String(option),
              value: String(option),
            }))
          : [];

        return (
          <ParameterControl key={parameter.key} gap="xs">
            <Text size="xs" bold>
              {parameter.label}
              {parameter.required ? ' *' : ''}
            </Text>
            {parameter.type === 'boolean' ? (
              <Checkbox
                checked={Boolean(value)}
                disabled={disabled}
                onChange={event => update(parameter.key, event.target.checked)}
              >
                {t('Enabled')}
              </Checkbox>
            ) : parameter.type === 'enum' ? (
              <Select
                options={options}
                value={primitiveString(value)}
                disabled={disabled}
                onChange={option => update(parameter.key, option.value)}
              />
            ) : parameter.type === 'project' ? (
              <Select
                options={projectOptions}
                value={typeof value === 'number' ? value : undefined}
                disabled={disabled}
                onChange={option => update(parameter.key, option.value)}
              />
            ) : parameter.type === 'project_list' ? (
              <Select
                multiple
                options={projectOptions}
                value={Array.isArray(value) ? value : []}
                disabled={disabled}
                onChange={selected =>
                  update(
                    parameter.key,
                    selected.map(option => option.value)
                  )
                }
              />
            ) : parameter.type === 'datetime_range' ? (
              <Grid columns={2} gap="sm">
                <Input
                  type="datetime-local"
                  aria-label={t('%s start', parameter.label)}
                  disabled={disabled}
                  value={datetimeLocalValue(getRangeValue(value, 'start'))}
                  onChange={event =>
                    update(parameter.key, {
                      ...asRange(value),
                      start: toIsoDate(event.target.value),
                    })
                  }
                />
                <Input
                  type="datetime-local"
                  aria-label={t('%s end', parameter.label)}
                  disabled={disabled}
                  value={datetimeLocalValue(getRangeValue(value, 'end'))}
                  onChange={event =>
                    update(parameter.key, {
                      ...asRange(value),
                      end: toIsoDate(event.target.value),
                    })
                  }
                />
              </Grid>
            ) : (
              <Input
                aria-label={parameter.label}
                type={
                  parameter.type === 'number' || parameter.type === 'duration'
                    ? 'number'
                    : 'text'
                }
                disabled={disabled}
                value={
                  parameter.type === 'environment_list'
                    ? (Array.isArray(value) ? value : []).join(', ')
                    : primitiveString(value)
                }
                placeholder={
                  parameter.type === 'environment_list'
                    ? t('production, staging')
                    : parameter.description || undefined
                }
                onChange={event => {
                  const raw = event.target.value;
                  if (parameter.type === 'environment_list') {
                    update(
                      parameter.key,
                      raw
                        .split(',')
                        .map(item => item.trim())
                        .filter(Boolean)
                    );
                  } else if (
                    parameter.type === 'number' ||
                    parameter.type === 'duration'
                  ) {
                    update(parameter.key, raw === '' ? null : Number(raw));
                  } else {
                    update(parameter.key, raw);
                  }
                }}
              />
            )}
            {errors[parameter.key] ? (
              <Text size="xs" variant="danger">
                {errors[parameter.key]}
              </Text>
            ) : null}
          </ParameterControl>
        );
      })}
      {saveError ? (
        <Text size="sm" variant="danger">
          {saveError}
        </Text>
      ) : null}
    </ParameterSection>
  );
}

function asRange(value: unknown): {end?: string; start?: string} {
  return typeof value === 'object' && value !== null ? value : {};
}

function getRangeValue(value: unknown, key: 'start' | 'end'): string | undefined {
  const range = asRange(value);
  return typeof range[key] === 'string' ? range[key] : undefined;
}

function datetimeLocalValue(value?: string): string {
  return value ? value.slice(0, 16) : '';
}

function toIsoDate(value: string): string {
  return value ? new Date(value).toISOString() : '';
}

function primitiveString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function getParameterErrors(
  parameters: InvestigationParameter[],
  values: Record<string, unknown>
): Record<string, string> {
  return Object.fromEntries(
    parameters.flatMap(parameter => {
      const error = validateParameter(parameter, values[parameter.key]);
      return error ? [[parameter.key, error]] : [];
    })
  );
}

function validateParameter(
  parameter: InvestigationParameter,
  value: unknown
): string | undefined {
  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  if (empty) {
    return parameter.required ? t('This parameter is required.') : undefined;
  }

  const min = numericConstraint(parameter.constraints.min);
  const max = numericConstraint(parameter.constraints.max);
  if (parameter.type === 'string') {
    const maxLength = numericConstraint(parameter.constraints.maxLength);
    if (typeof value !== 'string') {
      return t('Enter text.');
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return t('Use no more than %s characters.', maxLength);
    }
  }
  if (parameter.type === 'number' || parameter.type === 'duration') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return t('Enter a number.');
    }
    if (parameter.type === 'duration' && !Number.isInteger(value)) {
      return t('Enter a whole number of seconds.');
    }
    if (min !== undefined && value < min) {
      return t('Enter a value of at least %s.', min);
    }
    if (max !== undefined && value > max) {
      return t('Enter a value of at most %s.', max);
    }
  }
  if (parameter.type === 'enum') {
    const options = Array.isArray(parameter.constraints.options)
      ? parameter.constraints.options
      : [];
    if (!options.includes(value)) {
      return t('Choose one of the available options.');
    }
  }
  if (parameter.type === 'datetime_range') {
    const range = asRange(value);
    const start = range.start ? new Date(range.start) : undefined;
    const end = range.end ? new Date(range.end) : undefined;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return t('Choose a start and end time.');
    }
    if (start >= end) {
      return t('The start must be before the end.');
    }
    const maxDays = numericConstraint(parameter.constraints.maxDays);
    if (maxDays !== undefined && end.getTime() - start.getTime() > maxDays * 86_400_000) {
      return t('The range cannot exceed %s days.', maxDays);
    }
  }
  if (parameter.type === 'environment_list' && Array.isArray(value)) {
    const maxItems = numericConstraint(parameter.constraints.maxItems);
    if (new Set(value).size !== value.length) {
      return t('Environment names must be unique.');
    }
    if (maxItems !== undefined && value.length > maxItems) {
      return t('Choose no more than %s environments.', maxItems);
    }
  }
  if (parameter.type === 'project_list' && Array.isArray(value)) {
    if (new Set(value).size !== value.length) {
      return t('Projects must be unique.');
    }
  }

  return undefined;
}

function numericConstraint(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

const ParameterSection = styled(Flex)`
  align-items: flex-start;
  gap: ${p => p.theme.space.md};
  flex-wrap: wrap;
`;

const ParameterControl = styled(Stack)`
  min-width: 180px;
`;

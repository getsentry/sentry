import styled from '@emotion/styled';
import {observer} from 'mobx-react-lite';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';
import type {
  NotebookStore,
  ParameterValidationError,
} from 'sentry/views/seerNotebook/stores/notebookStore';

type Props = {
  store: NotebookStore;
};

export const InvestigationParameters = observer(
  function InvestigationParametersComponent({store}: Props) {
    const {projects} = useProjects();
    const {parameters, parameterValues: values, parameterErrors: errors} = store;
    const disabled = store.isReadOnly;
    const projectOptions = projects.map(project => ({
      label: project.slug,
      value: project.id,
    }));

    if (parameters.length === 0) {
      return null;
    }

    const update = (key: string, value: unknown) => store.editParameterValue(key, value);

    return (
      <ParameterSection onBlur={() => void store.flushParameterValues()}>
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
                  {parameterErrorMessage(errors[parameter.key])}
                </Text>
              ) : null}
            </ParameterControl>
          );
        })}
        {store.parameterSaveState === 'unsaved' ? (
          <Text size="sm" variant="danger">
            {t('Some parameter values could not be saved.')}
          </Text>
        ) : null}
      </ParameterSection>
    );
  }
);

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

function parameterErrorMessage(error?: ParameterValidationError): string {
  switch (error?.code) {
    case 'required':
      return t('This parameter is required.');
    case 'text':
      return t('Enter text.');
    case 'max_length':
      return t('Use no more than %s characters.', error.limit);
    case 'number':
      return t('Enter a number.');
    case 'integer_seconds':
      return t('Enter a whole number of seconds.');
    case 'min':
      return t('Enter a value of at least %s.', error.limit);
    case 'max':
      return t('Enter a value of at most %s.', error.limit);
    case 'enum':
      return t('Choose one of the available options.');
    case 'date_range':
      return t('Choose a start and end time.');
    case 'date_order':
      return t('The start must be before the end.');
    case 'max_days':
      return t('The range cannot exceed %s days.', error.limit);
    case 'duplicate_environments':
      return t('Environment names must be unique.');
    case 'max_environments':
      return t('Choose no more than %s environments.', error.limit);
    case 'duplicate_projects':
      return t('Projects must be unique.');
    default:
      return '';
  }
}

const ParameterSection = styled(Flex)`
  align-items: flex-start;
  gap: ${p => p.theme.space.md};
  flex-wrap: wrap;
`;

const ParameterControl = styled(Stack)`
  min-width: 180px;
`;

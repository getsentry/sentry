import {stringify} from 'yaml';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {Convention} from 'sentry/views/codeConventions/conventionConfig';

const DISABLED_REASON = t('Editing conventions is not available yet');

/**
 * Examples and filters are structured in the YAML, so they're edited as YAML
 * rather than as prose like the other sections.
 */
function toYamlValue(value: Record<string, unknown> | undefined) {
  const defined = Object.fromEntries(
    Object.entries(value ?? {}).filter(([, v]) => v !== undefined)
  );
  return Object.keys(defined).length ? stringify(defined) : '';
}

interface Props {
  convention: Convention;
}

export function ConventionEditForm({convention}: Props) {
  const defaultValues = {
    why: convention.why ?? '',
    detect: convention.detect ?? '',
    fix: convention.fix ?? '',
    examples: toYamlValue(convention.examples),
    filters: toYamlValue({
      include: convention.include,
      exclude: convention.exclude,
      prefilter: convention.prefilter,
      detect_command: convention.detect_command,
    }),
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    onSubmit: () => {},
  });

  const fields = [
    {name: 'why', label: t('Why')},
    {name: 'detect', label: t('Detect')},
    {name: 'fix', label: t('Fix')},
    {name: 'examples', label: t('Examples')},
    {name: 'filters', label: t('Filters')},
  ] as const;

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        {fields.map(({name, label}) =>
          defaultValues[name] ? (
            <form.AppField key={name} name={name}>
              {field => (
                <field.Layout.Stack label={label}>
                  <field.TextArea
                    autosize
                    disabled={DISABLED_REASON}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          ) : null
        )}
        <Flex justify="end">
          <form.SubmitButton
            variant="primary"
            disabled
            tooltipProps={{title: DISABLED_REASON}}
          >
            {t('Save')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

import {stringify} from 'yaml';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import {
  getConventionCommand,
  getConventionFileUrls,
  type Convention,
} from 'sentry/views/codeConventions/utils';

const SAVE_DISABLED_REASON = t('Saving conventions is not available yet');

/**
 * Examples are structured in the YAML, so they're edited as YAML rather than
 * as prose like the other sections.
 */
function toYamlValue(value: Record<string, unknown> | undefined) {
  const defined = Object.fromEntries(
    Object.entries(value ?? {}).filter(([, v]) => v !== undefined)
  );
  return Object.keys(defined).length ? stringify(defined) : '';
}

interface Props {
  convention: Convention;
  filename: string;
}

export function ConventionEditForm({convention, filename}: Props) {
  const command = getConventionCommand(convention);
  const defaultValues = {
    why: convention.why ?? '',
    detect: convention.detect ?? '',
    fix: convention.fix ?? '',
    examples: toYamlValue(convention.examples),
    filters: command?.command ?? '',
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
    {name: 'filters', label: command?.title ?? t('Filters')},
  ] as const;

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        <Alert variant="info" showIcon>
          {tct('Saving changes is not supported. Create a PR at [link] instead.', {
            link: (
              <ExternalLink href={getConventionFileUrls(filename).htmlUrl}>
                {filename}
              </ExternalLink>
            ),
          })}
        </Alert>
        {fields.map(({name, label}) =>
          defaultValues[name] ? (
            <form.AppField key={name} name={name}>
              {field => (
                <field.Layout.Stack label={label}>
                  <field.TextArea
                    autosize
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
            tooltipProps={{title: SAVE_DISABLED_REASON}}
          >
            {t('Save')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

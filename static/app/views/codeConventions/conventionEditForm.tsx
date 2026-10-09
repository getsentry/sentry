import {stringify} from 'yaml';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import {
  getConventionCommand,
  getConventionFileUrls,
  getConventionSchedule,
  getNewConventionFileUrl,
  type Convention,
} from 'sentry/views/codeConventions/utils';
import {crontabAsText} from 'sentry/views/insights/crons/utils/crontabAsText';

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
  /**
   * The existing convention's file. Without it the form is for a new
   * convention, and shows every field rather than only the ones with values.
   */
  filename?: string;
}

export function ConventionEditForm({convention, filename}: Props) {
  const isNew = filename === undefined;
  const command = getConventionCommand(convention);
  const defaultValues = {
    schedule: getConventionSchedule(convention),
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
    {name: 'filters', label: command?.title ?? t('Prefilter')},
  ] as const;

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        <Alert variant="info" showIcon>
          {isNew
            ? tct('Saving changes is not supported. [link] instead.', {
                link: (
                  <ExternalLink href={getNewConventionFileUrl()}>
                    {t('Create a PR adding a convention file')}
                  </ExternalLink>
                ),
              })
            : tct('Saving changes is not supported. Create a PR at [link] instead.', {
                link: (
                  <ExternalLink href={getConventionFileUrls(filename).htmlUrl}>
                    {filename}
                  </ExternalLink>
                ),
              })}
        </Alert>
        <form.AppField name="schedule">
          {field => (
            <field.Layout.Stack
              label={t('Schedule')}
              hintText={
                crontabAsText(field.state.value)
                  ? t('%s UTC', crontabAsText(field.state.value))
                  : t('Not a valid cron expression')
              }
            >
              <field.Input
                monospace
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="* * * * *"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        {fields.map(({name, label}) =>
          isNew || defaultValues[name] ? (
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

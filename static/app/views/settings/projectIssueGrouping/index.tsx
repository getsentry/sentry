import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {
  defaultFormOptions,
  FieldGroup,
  FormSearch,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

function FingerprintRulesForm({
  project,
  hasAccess,
}: {
  hasAccess: boolean;
  project: DetailedProject;
}) {
  const updateProject = useUpdateProject(project);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {fingerprintingRules: project.fingerprintingRules ?? ''},
    validators: {onDynamic: z.object({fingerprintingRules: z.string()})},
    onSubmit: ({value, formApi}) =>
      updateProject
        .mutateAsync(value)
        .then(() => {
          formApi.reset(value);
          addSuccessMessage(t('Fingerprint rules updated.'));
        })
        .catch((error: unknown) => {
          // Surface API validation errors (e.g. invalid rule syntax) inline.
          if (error instanceof RequestError && setFieldErrors(formApi, error)) {
            return;
          }
          addErrorMessage(t('Unable to save changes.'));
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/issue-grouping/">
        <FieldGroup title={t('Fingerprint Rules')}>
          <form.AppField name="fingerprintingRules">
            {field => (
              <field.Layout.Stack label={t('Fingerprint Rules')}>
                <Stack gap="md">
                  <Text as="p" variant="muted" size="sm">
                    {tct(
                      `This can be used to modify the fingerprint rules on the server with custom rules. Rules follow the pattern [pattern]. To learn more about fingerprint rules, [docs:read the docs].`,
                      {
                        pattern: <code>matcher:glob -&gt; fingerprint, values</code>,
                        docs: (
                          <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/fingerprint-rules/" />
                        ),
                      }
                    )}
                  </Text>
                  <Container background="secondary" padding="md lg" radius="md">
                    <Text as="div" monospace size="sm" wrap="pre-wrap">
                      {`# force all errors of the same type to have the same fingerprint
error.type:DatabaseUnavailable -> system-down
# force all memory allocation errors to be grouped together
stack.function:malloc -> memory-allocation-error`}
                    </Text>
                  </Container>
                  <field.TextArea
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={!hasAccess}
                    monospace
                    autosize
                    rows={2}
                    maxRows={20}
                    placeholder={t(
                      'error.type:MyException -> fingerprint-value\nstack.function:some_panic_function -> fingerprint-value'
                    )}
                  />
                </Stack>
              </field.Layout.Stack>
            )}
          </form.AppField>

          {hasAccess && (
            <Stack gap="lg">
              <form.Subscribe selector={state => state.isDirty}>
                {isDirty =>
                  isDirty ? (
                    <Alert variant="info" showIcon={false}>
                      {t(
                        'Changing fingerprint rules will apply to future events only (can take up to a minute).'
                      )}
                    </Alert>
                  ) : null
                }
              </form.Subscribe>
              <Flex gap="sm" justify="end">
                <form.ResetButton>{t('Cancel')}</form.ResetButton>
                <form.SubmitButton>{t('Save')}</form.SubmitButton>
              </Flex>
            </Stack>
          )}
        </FieldGroup>
      </FormSearch>
    </form.AppForm>
  );
}

function StackTraceRulesForm({
  project,
  hasAccess,
}: {
  hasAccess: boolean;
  project: DetailedProject;
}) {
  const updateProject = useUpdateProject(project);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {groupingEnhancements: project.groupingEnhancements ?? ''},
    validators: {onDynamic: z.object({groupingEnhancements: z.string()})},
    onSubmit: ({value, formApi}) =>
      updateProject
        .mutateAsync(value)
        .then(() => {
          formApi.reset(value);
          addSuccessMessage(t('Stack trace rules updated.'));
        })
        .catch((error: unknown) => {
          // Surface API validation errors (e.g. invalid rule syntax) inline.
          if (error instanceof RequestError && setFieldErrors(formApi, error)) {
            return;
          }
          addErrorMessage(t('Unable to save changes.'));
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/issue-grouping/">
        <FieldGroup title={t('Stack Trace Rules')}>
          <form.AppField name="groupingEnhancements">
            {field => (
              <field.Layout.Stack label={t('Stack Trace Rules')}>
                <Stack gap="md">
                  <Text as="p" variant="muted" size="sm">
                    {tct(
                      `This can be used to enhance the grouping algorithm with custom rules. Rules follow the pattern [pattern]. To learn more about stack trace rules, [docs:read the docs].`,
                      {
                        pattern: <code>matcher:glob [v^]?[+-]flag</code>,
                        docs: (
                          <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/stack-trace-rules/" />
                        ),
                      }
                    )}
                  </Text>
                  <Container background="secondary" padding="md lg" radius="md">
                    <Text as="div" monospace size="sm" wrap="pre-wrap">
                      {`# remove all frames above a certain function from grouping
stack.function:panic_handler ^-group
# mark all functions following a prefix in-app
stack.function:mylibrary_* +app`}
                    </Text>
                  </Container>
                  <field.TextArea
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={!hasAccess}
                    monospace
                    autosize
                    rows={2}
                    maxRows={20}
                    placeholder={t(
                      'stack.function:raise_an_exception ^-group\nstack.function:namespace::* +app'
                    )}
                  />
                </Stack>
              </field.Layout.Stack>
            )}
          </form.AppField>

          {hasAccess && (
            <Stack gap="lg">
              <form.Subscribe selector={state => state.isDirty}>
                {isDirty =>
                  isDirty ? (
                    <Alert variant="info" showIcon={false}>
                      {t(
                        'Changing stack trace rules will apply to future events only (can take up to a minute).'
                      )}
                    </Alert>
                  ) : null
                }
              </form.Subscribe>
              <Flex gap="sm" justify="end">
                <form.ResetButton>{t('Cancel')}</form.ResetButton>
                <form.SubmitButton>{t('Save')}</form.SubmitButton>
              </Flex>
            </Stack>
          )}
        </FieldGroup>
      </FormSearch>
    </form.AppForm>
  );
}

function DerivedGroupingEnhancements({project}: {project: DetailedProject}) {
  return (
    <FieldGroup title={t('Derived Grouping Enhancements')}>
      <Stack gap="md">
        <Text as="p" variant="muted" size="sm">
          {t(
            'These rules are automatically derived for some languages for organizations that have the GitHub integration. These rules are not editable but they can be negated by adding you own rules in the Stack Trace Rules section.'
          )}
        </Text>
        <TextArea
          aria-label={t('Derived Grouping Enhancements')}
          value={project.derivedGroupingEnhancements ?? ''}
          disabled
          monospace
          autosize
          rows={2}
          maxRows={20}
          readOnly
        />
      </Stack>
    </FieldGroup>
  );
}

export default function ProjectIssueGrouping() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  return (
    <SentryDocumentTitle title={routeTitleGen(t('Issue Grouping'), project.slug, false)}>
      <SettingsPageHeader
        marginBottom="xl"
        title={t('Issue Grouping')}
        subtitle={tct(
          'All events have a fingerprint. Events with the same fingerprint are grouped together into an issue. To learn more about issue grouping, [link: read the docs].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/" />
            ),
          }
        )}
      />

      <ProjectPermissionAlert project={project} />
      <FingerprintRulesForm project={project} hasAccess={hasAccess} />
      <StackTraceRulesForm project={project} hasAccess={hasAccess} />
      <DerivedGroupingEnhancements project={project} />
    </SentryDocumentTitle>
  );
}

import {Fragment} from 'react';
import styled from '@emotion/styled';
import {mutationOptions, useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {
  defaultFormOptions,
  FieldGroup,
  FormSearch,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject, Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

function getProjectMutationOptions(organization: Organization, project: Project) {
  const endpoint = `/projects/${organization.slug}/${project.slug}/`;

  return mutationOptions({
    mutationFn: (data: Partial<DetailedProject>) =>
      fetchMutation<Project>({method: 'PUT', url: endpoint, data}),
    onSuccess: (data: Project) => {
      // This will update our project context
      ProjectsStore.onUpdateSuccess(data);
    },
  });
}

function FingerprintRulesForm({
  project,
  hasAccess,
}: {
  hasAccess: boolean;
  project: DetailedProject;
}) {
  const organization = useOrganization();
  const projectMutation = useMutation(getProjectMutationOptions(organization, project));
  const saveMessage = t(
    'Changing fingerprint rules will apply to future events only (can take up to a minute).'
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    formId: 'project-issue-grouping-fingerprinting-rules',
    defaultValues: {fingerprintingRules: project.fingerprintingRules ?? ''},
    validators: {onDynamic: z.object({fingerprintingRules: z.string()})},
    onSubmit: ({value, formApi}) =>
      projectMutation
        .mutateAsync({fingerprintingRules: value.fingerprintingRules})
        .then(() => {
          formApi.reset(value);
          addSuccessMessage(saveMessage);
        })
        .catch(() => {
          addErrorMessage(t('Unable to save changes.'));
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/issue-grouping/">
        <FieldGroup>
          <form.AppField name="fingerprintingRules">
            {field => (
              <field.Layout.Stack
                label={t('Fingerprint Rules')}
                hintText={
                  <Fragment>
                    <RuleDescription>
                      {tct(
                        `This can be used to modify the fingerprint rules on the server with custom rules.
        Rules follow the pattern [pattern]. To learn more about fingerprint rules, [docs:read the docs].`,
                        {
                          pattern: <code>matcher:glob -&gt; fingerprint, values</code>,
                          docs: (
                            <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/fingerprint-rules/" />
                          ),
                        }
                      )}
                    </RuleDescription>
                    <RuleExample>
                      {`# force all errors of the same type to have the same fingerprint
error.type:DatabaseUnavailable -> system-down
# force all memory allocation errors to be grouped together
stack.function:malloc -> memory-allocation-error`}
                    </RuleExample>
                  </Fragment>
                }
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t(
                    'error.type:MyException -> fingerprint-value\nstack.function:some_panic_function -> fingerprint-value'
                  )}
                  disabled={!hasAccess}
                  monospace
                  autosize
                  rows={1}
                  maxRows={20}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          {hasAccess && (
            <Flex gap="md" align="center">
              <form.Subscribe selector={state => state.isDirty}>
                {isDirty =>
                  isDirty ? (
                    <Flex flex="1" minWidth={0}>
                      <Alert variant="info">{saveMessage}</Alert>
                    </Flex>
                  ) : null
                }
              </form.Subscribe>
              <Flex gap="sm" justify="end" flexShrink={0}>
                <form.ResetButton>{t('Cancel')}</form.ResetButton>
                <form.SubmitButton>{t('Save')}</form.SubmitButton>
              </Flex>
            </Flex>
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
  const organization = useOrganization();
  const projectMutation = useMutation(getProjectMutationOptions(organization, project));
  const saveMessage = t(
    'Changing stack trace rules will apply to future events only (can take up to a minute).'
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    formId: 'project-issue-grouping-stack-trace-rules',
    defaultValues: {groupingEnhancements: project.groupingEnhancements ?? ''},
    validators: {onDynamic: z.object({groupingEnhancements: z.string()})},
    onSubmit: ({value, formApi}) =>
      projectMutation
        .mutateAsync({groupingEnhancements: value.groupingEnhancements})
        .then(() => {
          formApi.reset(value);
          addSuccessMessage(saveMessage);
        })
        .catch(() => {
          addErrorMessage(t('Unable to save changes.'));
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/issue-grouping/">
        <FieldGroup>
          <form.AppField name="groupingEnhancements">
            {field => (
              <field.Layout.Stack
                label={t('Stack Trace Rules')}
                hintText={
                  <Fragment>
                    <RuleDescription>
                      {tct(
                        `This can be used to enhance the grouping algorithm with custom rules.
        Rules follow the pattern [pattern]. To learn more about stack trace rules, [docs:read the docs].`,
                        {
                          pattern: <code>matcher:glob [v^]?[+-]flag</code>,
                          docs: (
                            <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/stack-trace-rules/" />
                          ),
                        }
                      )}
                    </RuleDescription>
                    <RuleExample>
                      {`# remove all frames above a certain function from grouping
stack.function:panic_handler ^-group
# mark all functions following a prefix in-app
stack.function:mylibrary_* +app`}
                    </RuleExample>
                  </Fragment>
                }
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t(
                    'stack.function:raise_an_exception ^-group\nstack.function:namespace::* +app'
                  )}
                  disabled={!hasAccess}
                  monospace
                  autosize
                  rows={1}
                  maxRows={20}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          {hasAccess && (
            <Flex gap="md" align="center">
              <form.Subscribe selector={state => state.isDirty}>
                {isDirty =>
                  isDirty ? (
                    <Flex flex="1" minWidth={0}>
                      <Alert variant="info">{saveMessage}</Alert>
                    </Flex>
                  ) : null
                }
              </form.Subscribe>
              <Flex gap="sm" justify="end" flexShrink={0}>
                <form.ResetButton>{t('Cancel')}</form.ResetButton>
                <form.SubmitButton>{t('Save')}</form.SubmitButton>
              </Flex>
            </Flex>
          )}
        </FieldGroup>
      </FormSearch>
    </form.AppForm>
  );
}

function DerivedGroupingEnhancements({project}: {project: DetailedProject}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    formId: 'project-issue-grouping-derived-enhancements',
    defaultValues: {
      derivedGroupingEnhancements: project.derivedGroupingEnhancements ?? '',
    },
    validators: {onDynamic: z.object({derivedGroupingEnhancements: z.string()})},
    onSubmit: () => {},
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/issue-grouping/">
        <FieldGroup>
          <form.AppField name="derivedGroupingEnhancements">
            {field => (
              <field.Layout.Stack
                label={t('Derived Grouping Enhancements')}
                hintText={t(
                  'These rules are automatically derived for some languages for organizations that have the GitHub integration. These rules are not editable but they can be negated by adding you own rules in the Stack Trace Rules section.'
                )}
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled
                  monospace
                  autosize
                  rows={1}
                  maxRows={20}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </FieldGroup>
      </FormSearch>
    </form.AppForm>
  );
}

export default function ProjectIssueGrouping() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  return (
    <SentryDocumentTitle title={routeTitleGen(t('Issue Grouping'), project.slug, false)}>
      <SettingsPageHeader
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

const RuleDescription = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
  margin-top: -${p => p.theme.space.md};
`;

const RuleExample = styled('pre')`
  margin-bottom: ${p => p.theme.space.md};
`;

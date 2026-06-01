import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {
  AUTOFIX_STOPPING_POINT_TO_USER_FACING,
  PROJECT_STOPPING_POINT_OPTIONS,
  USER_FACING_TO_AUTOFIX_STOPPING_POINT,
  type UserFacingStoppingPoint,
} from 'sentry/utils/seer/stoppingPoint';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

const schema = z.object({
  defaultAutofixAutomationTuning: z.boolean(),
  autoOpenPrs: z.boolean(),
  defaultCodingAgent: z.string().nullable(),
  defaultCodingAgentIntegrationId: z.number().nullable(),
});

interface Props {
  organization: Organization;
}

export function ProjectDefaultsForm({organization}: Props) {
  const canWrite = useCanWriteSettings();

  const stoppingPointValue = organization.defaultAutomatedRunStoppingPoint
    ? AUTOFIX_STOPPING_POINT_TO_USER_FACING[organization.defaultAutomatedRunStoppingPoint]
    : 'off';

  const orgEndpoint = `/organizations/${organization.slug}/`;
  const autofixTuningMutationOpts = mutationOptions({
    mutationFn: (data: {defaultAutofixAutomationTuning: boolean}) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: orgEndpoint,
        data: {
          defaultAutofixAutomationTuning: data.defaultAutofixAutomationTuning
            ? 'medium'
            : 'off',
        },
      }),
    onSuccess: updateOrganization,
  });

  return (
    <Stack gap="lg">
      {canWrite ? null : (
        <Alert variant="warning">
          {t(
            'These settings can only be edited by users with the organization owner or manager role.'
          )}
        </Alert>
      )}
      <FieldGroup>
        <AutoSaveForm
          name="defaultAutofixAutomationTuning"
          schema={schema}
          initialValue={Boolean(
            organization.defaultAutofixAutomationTuning &&
            organization.defaultAutofixAutomationTuning !== 'off'
          )}
          mutationOptions={autofixTuningMutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Default Handoff Agent')}
              hintText={tct(
                'Select the default agent to create a plan, and code up an issue fix. Seer Agent will always be used to triage and perform the Root Cause Analysis step, but after that you can hand the results to an agent to create a plan, code a fix, and draft a PR. [agents:Manage Coding Agents]',
                {
                  docs: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                  ),
                  agents: (
                    <Link
                      to={{
                        pathname: `/settings/${organization.slug}/integrations/`,
                        query: {category: 'coding agent'},
                      }}
                    />
                  ),
                }
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={!canWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
        <AutoSaveForm
          name="defaultAutomatedRunStoppingPoint"
          schema={z.object({
            defaultAutomatedRunStoppingPoint: z.enum([
              'off',
              'root_cause',
              'plan',
              'create_pr',
            ]),
          })}
          initialValue={stoppingPointValue}
          mutationOptions={mutationOptions({
            mutationFn: (data: {
              defaultAutomatedRunStoppingPoint: UserFacingStoppingPoint;
            }) =>
              fetchMutation<Organization>({
                method: 'PUT',
                url: orgEndpoint,
                data: {
                  defaultAutomatedRunStoppingPoint:
                    USER_FACING_TO_AUTOFIX_STOPPING_POINT[
                      data.defaultAutomatedRunStoppingPoint
                    ] ?? null,
                },
              }),
            onSuccess: updateOrganization,
          })}
        >
          {field => (
            <field.Layout.Row
              label={t('Default Automation Steps')}
              hintText={
                <Stack gap="sm">
                  <span>
                    {tct(
                      'Choose which steps Seer should run automatically on issues. Depending on how [docs:actionable] the issue is, Seer may stop at an earlier step.',
                      {
                        docs: (
                          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                        ),
                      }
                    )}
                  </span>
                  {organization.enableSeerCoding === false && (
                    <Alert variant="warning">
                      {tct(
                        '[settings:"Enable Code Generation"] must be enabled for Seer to create pull requests.',
                        {
                          settings: (
                            <Link
                              to={`/settings/${organization.slug}/seer/advanced/#enableSeerCoding`}
                            />
                          ),
                        }
                      )}
                    </Alert>
                  )}
                </Stack>
              }
            >
              <field.Select
                disabled={!canWrite}
                value={field.state.value}
                onChange={field.handleChange}
                options={PROJECT_STOPPING_POINT_OPTIONS}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </Stack>
  );
}

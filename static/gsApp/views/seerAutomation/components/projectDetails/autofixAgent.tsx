import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {
  organizationIntegrationsCodingAgents,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import {LoadingError} from 'sentry/components/loadingError';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useMutation, useQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useFetchAgentOptions} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';
import {
  getProjectStoppingPointMutationOptions,
  getProjectStoppingPointValue,
  useFetchStoppingPointOptions,
} from 'sentry/views/settings/seer/overview/utils/seerStoppingPoint';
import {
  useMutateSelectedAgent,
  useSelectedAgentFromProjectSettings,
} from 'sentry/views/settings/seer/seerAgentHooks';

import {CodingAgentSettings} from 'getsentry/views/seerAutomation/components/projectDetails/agentSettings/codingAgentSettings';
import {SeerAgentSettings} from 'getsentry/views/seerAutomation/components/projectDetails/agentSettings/seerAgentSettings';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
}

function AgentSpecificFields({
  integration,
  ...props
}: Props & {
  integration: 'seer' | CodingAgentIntegration;
}) {
  if (integration === 'seer') {
    return <SeerAgentSettings {...props} />;
  }
  if (integration.provider === 'cursor' || integration.provider === 'claude_code') {
    return <CodingAgentSettings integration={integration} {...props} />;
  }
  return null;
}

export function AutofixAgent({canWrite, preference, project}: Props) {
  const organization = useOrganization();
  const {
    data: integrations,
    isPending,
    isError,
  } = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });
  const options = useFetchAgentOptions({organization});
  const selected = useSelectedAgentFromProjectSettings({
    preference,
    integrations: integrations ?? [],
  });
  const mutateSelectedAgent = useMutateSelectedAgent({project});

  const disabledReason = canWrite
    ? null
    : t('You do not have permission to update this setting.');

  return (
    <PanelNoMargin>
      <PanelHeader>{t('Autofix Handoff')}</PanelHeader>
      <PanelBody>
        {isPending ? (
          <Flex justify="center" align="center" padding="xl">
            <Placeholder height="52px" />
          </Flex>
        ) : isError ? (
          <LoadingError />
        ) : (
          <Fragment>
            {/* If the `agent` is undefined then we have a problem! Show an alert? */}
            <SelectField
              disabled={Boolean(disabledReason)}
              disabledReason={disabledReason}
              name="autofixAgent"
              label={t('Autofix Handoff')}
              help={tct(
                'Seer will orchestrate the autofix process, and automatically hand off issue data to the coding agent for processing. You can choose to automatically process Issues, and which agent to use here. You can also manually trigger autofix with different agents from the Issue Details page. [docsLink:Read the docs] to learn more.',
                {
                  docsLink: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/" />
                  ),
                }
              )}
              options={options.data ?? []}
              value={selected}
              onChange={(integration: 'seer' | CodingAgentIntegration) => {
                mutateSelectedAgent(integration, {
                  onSuccess: () =>
                    addSuccessMessage(
                      tct('Started using [name] as coding agent', {
                        name: (
                          <strong>
                            {integration === 'seer' ? t('Seer Agent') : integration.name}
                          </strong>
                        ),
                      })
                    ),
                  onError: () =>
                    addErrorMessage(
                      tct('Failed to set [name] as coding agent', {
                        name: (
                          <strong>
                            {integration === 'seer' ? t('Seer Agent') : integration.name}
                          </strong>
                        ),
                      })
                    ),
                });
              }}
            />
            {selected ? (
              <AgentSpecificFields
                integration={selected}
                canWrite={canWrite}
                preference={preference}
                project={project}
              />
            ) : null}

            {selected ? (
              <StoppingPointField
                agent={selected}
                canWrite={canWrite}
                preference={preference}
                project={project}
              />
            ) : null}
          </Fragment>
        )}
      </PanelBody>
    </PanelNoMargin>
  );
}

function StoppingPointField({
  agent,
  canWrite,
  preference,
  project,
}: {
  agent: 'seer' | CodingAgentIntegration;
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const stoppingPointMutationOpts = getProjectStoppingPointMutationOptions({
    organization,
    project,
    preference,
    queryClient,
  });
  const {mutate} = useMutation({
    ...stoppingPointMutationOpts,
    onSuccess: (data, variables, onMutateResult, context) => {
      stoppingPointMutationOpts.onSuccess?.(data, variables, onMutateResult, context);
      addSuccessMessage(t('Stopping point updated'));
    },
    onError: () => {
      addErrorMessage(t('Failed to update stopping point'));
    },
  });

  const initialValue = getProjectStoppingPointValue(project, preference);
  const options = useFetchStoppingPointOptions({
    agent,
    organization,
  });

  return (
    <SelectField
      name="stoppingPoint"
      disabled={!canWrite}
      value={initialValue}
      onChange={value => {
        mutate({stoppingPoint: value});
      }}
      options={options}
      label={t('Automation Steps')}
      help={tct(
        'Choose which steps Seer should run automatically on issues. Depending on how [actionable:actionable] the issue is, Seer may stop at an earlier step.',
        {
          actionable: (
            <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
          ),
        }
      )}
    />
  );
}

const PanelNoMargin = styled(Panel)`
  margin-bottom: 0;
`;

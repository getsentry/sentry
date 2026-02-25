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
import SelectField from 'sentry/components/forms/fields/selectField';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import CursorAgentSettings from 'getsentry/views/seerAutomation/components/projectDetails/agentSettings/cursorAgentSettings';
import SeerAgentSettings from 'getsentry/views/seerAutomation/components/projectDetails/agentSettings/seerAgentSettings';
import {
  useAgentOptions,
  useMutateSelectedAgent,
  useSelectedAgent,
} from 'getsentry/views/seerAutomation/components/projectDetails/useAgentHooks';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
}

function AgentSpecificFields({
  integration,
  ...props
}: Props & {
  integration: 'seer' | 'none' | CodingAgentIntegration;
}) {
  if (integration === 'seer') {
    return <SeerAgentSettings {...props} />;
  }
  if (integration === 'none') {
    return null;
  }
  if (integration.provider === 'cursor') {
    return <CursorAgentSettings integration={integration} {...props} />;
  }
  return null;
}

export default function AutofixAgent({canWrite, preference, project}: Props) {
  const organization = useOrganization();
  const {
    data: integrations,
    isPending,
    isError,
  } = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });
  const options = useAgentOptions({integrations: integrations ?? []});
  const selected = useSelectedAgent({
    preference,
    project,
    integrations: integrations ?? [],
  });
  const mutateSelectedAgent = useMutateSelectedAgent({preference, project});

  const disabledReason = canWrite
    ? null
    : t('You do not have permission to update this setting.');

  return (
    <PanelNoMargin>
      <PanelHeader>{t('Autofix Agent')}</PanelHeader>
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
              label={t('Autofix Agent')}
              help={tct(
                'Seer will orchestrate the autofix process, and automatically hand off issue data coding agent for processing. You can choose to automatically process Issues, and which agent to use here. You can also manually trigger autofix with different agents from the Issue Details page. [docsLink:Read the docs] to learn more.',
                {
                  docsLink: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/" />
                  ),
                }
              )}
              options={options}
              value={selected}
              onChange={(integration: 'seer' | 'none' | CodingAgentIntegration) => {
                mutateSelectedAgent(integration, {
                  onSuccess: () =>
                    addSuccessMessage(
                      integration === 'none'
                        ? t('Removed coding agent')
                        : tct('Started using [name] as coding agent', {
                            name: (
                              <strong>
                                {integration === 'seer'
                                  ? t('Seer Agent')
                                  : integration.name}
                              </strong>
                            ),
                          })
                    ),
                  onError: () =>
                    addErrorMessage(
                      integration === 'none'
                        ? t('Failed to update coding agent')
                        : tct('Failed to set [name] as coding agent', {
                            name: (
                              <strong>
                                {integration === 'seer'
                                  ? t('Seer Agent')
                                  : integration.name}
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
          </Fragment>
        )}
      </PanelBody>
    </PanelNoMargin>
  );
}

const PanelNoMargin = styled(Panel)`
  margin-bottom: 0;
`;

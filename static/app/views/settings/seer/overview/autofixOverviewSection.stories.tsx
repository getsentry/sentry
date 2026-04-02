import {Fragment} from 'react';

import type {AutofixAutomationSettings} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import * as Storybook from 'sentry/stories';
import type {Organization} from 'sentry/types/organization';
import {useQueryClient} from 'sentry/utils/queryClient';
import {AutofixOverviewSection} from 'sentry/views/settings/seer/overview/autofixOverviewSection';

function makeSettings(projectId: string): AutofixAutomationSettings {
  return {
    projectId,
    autofixAutomationTuning: 'medium',
    automatedRunStoppingPoint: 'code_changes',
    automationHandoff: undefined,
    reposCount: 0,
  };
}

const BASE_ORG = {
  slug: 'my-org',
  defaultCodingAgent: 'seer',
  autoOpenPrs: false,
  access: ['org:read', 'org:write', 'org:admin'],
} as Organization;

function makeProps(
  projectsWithPreferredAgent: AutofixAutomationSettings[],
  org: Organization = BASE_ORG
) {
  return {
    canWrite: false,
    organization: org,
    data: {
      projectsWithRepos: [],
      projectsWithPreferredAgent,
      projectsWithCreatePr: [],
    } as any,
    isPending: false,
    ...({} as any),
  };
}

export default Storybook.story('AgentNameForm', story => {
  story('Overview', () => (
    <Fragment>
      <p>
        The <Storybook.JSXNode name="AgentNameForm" /> (rendered inside{' '}
        <Storybook.JSXNode name="AutofixOverviewSection" />) shows a summary label below
        the agent selector. The label reflects how many of the organization&apos;s
        existing projects are configured to use the preferred coding agent.
      </p>
      <p>
        The label has five variants: no projects, single project (uses / does not use),
        all projects use, and a partial count. When the preferred agent is a named
        integration (e.g. Cursor), the agent name in the label updates accordingly.
      </p>
    </Fragment>
  ));

  story('0 projects with preferred agent', () => (
    <AutofixOverviewSection {...makeProps([])} />
  ));

  story('Named integration (Cursor) as preferred agent', () => {
    const cursorOrg = {
      ...BASE_ORG,
      defaultCodingAgent: 'cursor',
      defaultCodingAgentIntegrationId: 42,
    } as Organization;

    const queryClient = useQueryClient();
    queryClient.setQueryData(organizationIntegrationsCodingAgents(cursorOrg).queryKey, {
      json: {integrations: [{id: '42', name: 'Cursor', provider: 'cursor'}]},
      headers: {Link: undefined, 'X-Hits': undefined, 'X-Max-Hits': undefined},
    });

    return <AutofixOverviewSection {...makeProps([makeSettings('1')], cursorOrg)} />;
  });
});

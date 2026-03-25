import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {AutofixOverviewSection} from 'sentry/views/settings/seer/overview/autofixOverviewSection';
import type {useSeerOverviewData} from 'sentry/views/settings/seer/overview/useSeerOverviewData';

type Stats = ReturnType<typeof useSeerOverviewData>['stats'];

const BASE_STATS: Stats = {
  integrationCount: 1,
  scmIntegrationCount: 1,
  seerIntegrations: [],
  seerIntegrationCount: 1,
  totalProjects: 5,
  projectsWithReposCount: 2,
  projectsWithAutomationCount: 2,
  projectsWithCreatePrCount: 1,
  totalRepoCount: 3,
  seerRepoCount: 3,
  reposWithSettingsCount: 2,
  reposWithCodeReviewCount: 1,
};

function Wrapper({
  children,
  overrides,
}: {
  children: React.ReactNode;
  overrides?: Partial<Organization>;
}) {
  const org = useOrganization();
  return (
    <OrganizationContext value={{...org, ...overrides}}>{children}</OrganizationContext>
  );
}

export default Storybook.story('AutofixOverviewSection', story => {
  story('Overview', () => (
    <Fragment>
      <p>
        The <Storybook.JSXNode name="AutofixOverviewSection" /> displays Autofix settings
        in the Seer settings overview. It contains two auto-save forms:
      </p>
      <ul>
        <li>
          <strong>Default Coding Agent</strong> — a select that sets which agent Seer
          hands off to for new projects. Shows how many existing projects use the
          currently selected agent, and a bulk-apply button.
        </li>
        <li>
          <strong>Allow Autofix to create PRs</strong> — a toggle that enables Autofix to
          open pull requests by default. Disabled and shows a warning when{' '}
          <code>enableSeerCoding</code> is <code>false</code>.
        </li>
      </ul>
      <p>
        The <code>stats</code> prop is supplied by the parent via{' '}
        <code>useSeerOverviewData()</code>. The coding agent options are fetched
        internally via the integrations API.
      </p>
    </Fragment>
  ));

  story('Loading', () => (
    <Wrapper>
      <AutofixOverviewSection stats={BASE_STATS} isLoading />
    </Wrapper>
  ));

  story('Single project — not configured', () => (
    <Wrapper>
      <AutofixOverviewSection
        stats={{
          ...BASE_STATS,
          totalProjects: 1,
          projectsWithReposCount: 0,
          projectsWithAutomationCount: 0,
          projectsWithCreatePrCount: 0,
        }}
        isLoading={false}
      />
    </Wrapper>
  ));

  story('Single project — all configured', () => (
    <Wrapper overrides={{defaultCodingAgent: 'seer', autoOpenPrs: true}}>
      <AutofixOverviewSection
        stats={{
          ...BASE_STATS,
          totalProjects: 1,
          projectsWithReposCount: 1,
          projectsWithAutomationCount: 1,
          projectsWithCreatePrCount: 1,
        }}
        isLoading={false}
      />
    </Wrapper>
  ));

  story('Many projects — none configured', () => (
    <Wrapper>
      <AutofixOverviewSection
        stats={{
          ...BASE_STATS,
          totalProjects: 8,
          projectsWithReposCount: 0,
          projectsWithAutomationCount: 0,
          projectsWithCreatePrCount: 0,
        }}
        isLoading={false}
      />
    </Wrapper>
  ));

  story('Many projects — some configured', () => (
    <Wrapper>
      <AutofixOverviewSection
        stats={{
          ...BASE_STATS,
          totalProjects: 8,
          projectsWithReposCount: 5,
          projectsWithAutomationCount: 3,
          projectsWithCreatePrCount: 2,
        }}
        isLoading={false}
      />
    </Wrapper>
  ));

  story('Many projects — all configured (bulk apply button disabled)', () => (
    <Wrapper overrides={{defaultCodingAgent: 'seer', autoOpenPrs: true}}>
      <AutofixOverviewSection
        stats={{
          ...BASE_STATS,
          totalProjects: 8,
          projectsWithReposCount: 8,
          projectsWithAutomationCount: 8,
          projectsWithCreatePrCount: 8,
        }}
        isLoading={false}
      />
    </Wrapper>
  ));

  story('Auto open PRs enabled — shows "have Create PR disabled" count', () => (
    <Wrapper overrides={{autoOpenPrs: true}}>
      <AutofixOverviewSection
        stats={{
          ...BASE_STATS,
          totalProjects: 8,
          projectsWithCreatePrCount: 6,
        }}
        isLoading={false}
      />
    </Wrapper>
  ));

  story('Auto open PRs disabled — shows "have Create PR enabled" count', () => (
    <Wrapper overrides={{autoOpenPrs: false}}>
      <AutofixOverviewSection
        stats={{
          ...BASE_STATS,
          totalProjects: 8,
          projectsWithCreatePrCount: 6,
        }}
        isLoading={false}
      />
    </Wrapper>
  ));

  story('Code generation disabled — warning alert shown, PR toggle forced off', () => (
    <Wrapper overrides={{enableSeerCoding: false}}>
      <AutofixOverviewSection stats={BASE_STATS} isLoading={false} />
    </Wrapper>
  ));

  story('Read-only (canWrite: false)', () => (
    <Wrapper overrides={{access: []}}>
      <AutofixOverviewSection stats={BASE_STATS} isLoading={false} />
    </Wrapper>
  ));
});

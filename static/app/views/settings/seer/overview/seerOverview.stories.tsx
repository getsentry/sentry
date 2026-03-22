import * as Storybook from 'sentry/stories';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {AutofixOverviewSection} from 'sentry/views/settings/seer/overview/autofixOverviewSection';
import {CodeReviewOverviewSection} from 'sentry/views/settings/seer/overview/codeReviewOverviewSection';
import {SeerOverview} from 'sentry/views/settings/seer/overview/components';
import {SCMOverviewSection} from 'sentry/views/settings/seer/overview/scmOverviewSection';
import type {useSeerOverviewData} from 'sentry/views/settings/seer/overview/useSeerOverviewData';

function OrganizationIntegrationsFixture(
  params: Partial<OrganizationIntegration> = {}
): OrganizationIntegration {
  return {
    accountType: '',
    gracePeriodEnd: '',
    organizationIntegrationStatus: 'active',
    domainName: 'github.com',
    icon: 'https://secure.gravatar.com/avatar/8b4cb68e40b74c90427d8262256bd1c8',
    id: '5',
    name: 'NisanthanNanthakumar',
    provider: {
      aspects: {},
      canAdd: true,
      canDisable: false,
      features: ['commits', 'issue-basic'],
      key: 'github',
      name: 'Github',
      slug: 'github',
    },
    status: 'active',
    configData: null,
    configOrganization: [],
    externalId: 'ext-integration-1',
    organizationId: '1',
    ...params,
  };
}

const seerIntegrationsFixture = [
  OrganizationIntegrationsFixture({id: '1', name: 'Integration A'}),
  OrganizationIntegrationsFixture({id: '2', name: 'Integration B'}),
];

const baseStats: ReturnType<typeof useSeerOverviewData>['stats'] = {
  integrationCount: 2,
  scmIntegrationCount: 2,
  seerIntegrations: seerIntegrationsFixture,
  seerIntegrationCount: 2,
  totalRepoCount: 10,
  seerRepoCount: 10, // equal to totalRepoCount: no "Add all repos" button
  reposWithSettingsCount: 10,
  projectsWithReposCount: 6, // equal to totalProjects: no "Handoff all to" CompactSelect
  projectsWithAutomationCount: 6,
  projectsWithCreatePrCount: 6,
  totalProjects: 6,
  reposWithCodeReviewCount: 10, // equal to seerRepoCount
};

function TestableOverview({
  stats,
  isLoading,
}: {
  isLoading: boolean;
  stats: ReturnType<typeof useSeerOverviewData>['stats'];
}) {
  return (
    <SeerOverview>
      <SCMOverviewSection stats={stats} isLoading={isLoading} />
      <AutofixOverviewSection stats={stats} isLoading={isLoading} />
      <CodeReviewOverviewSection stats={stats} isLoading={isLoading} />
    </SeerOverview>
  );
}

export default Storybook.story('SeerOverview', story => {
  story('No alerts (healthy state)', () => (
    <TestableOverview stats={baseStats} isLoading={false} />
  ));

  story('Loading state', () => <TestableOverview stats={baseStats} isLoading />);

  // SCM stories

  story('SCM: No SCM integrations installed', () => (
    <TestableOverview
      stats={{
        ...baseStats,
        integrationCount: 0,
        scmIntegrationCount: 0,
        seerIntegrations: [],
        seerIntegrationCount: 0,
        totalRepoCount: 0,
        seerRepoCount: 0,
        reposWithSettingsCount: 0,
        projectsWithReposCount: 0,
        projectsWithAutomationCount: 0,
        projectsWithCreatePrCount: 0,
        reposWithCodeReviewCount: 0,
      }}
      isLoading={false}
    />
  ));

  story('SCM: Integrations installed but no repos connected', () => (
    <TestableOverview
      stats={{
        ...baseStats,
        totalRepoCount: 0,
        seerRepoCount: 0,
        reposWithSettingsCount: 0,
        projectsWithReposCount: 0,
        projectsWithAutomationCount: 0,
        projectsWithCreatePrCount: 0,
        reposWithCodeReviewCount: 0,
      }}
      isLoading={false}
    />
  ));

  story('SCM: Some repos not yet added to Seer', () => (
    <TestableOverview
      stats={{
        ...baseStats,
        totalRepoCount: 10,
        seerRepoCount: 6, // seerRepoCount !== totalRepoCount → shows "Add all repos"
        reposWithSettingsCount: 6,
        projectsWithReposCount: 3,
        projectsWithAutomationCount: 2,
        projectsWithCreatePrCount: 1,
        reposWithCodeReviewCount: 2,
      }}
      isLoading={false}
    />
  ));

  // Autofix stories

  story('Autofix: No projects have repos linked', () => (
    <TestableOverview
      stats={{
        ...baseStats,
        projectsWithReposCount: 0, // hides header link, CompactSelect, and ButtonBar
        projectsWithAutomationCount: 0,
        projectsWithCreatePrCount: 0,
      }}
      isLoading={false}
    />
  ));

  story('Autofix: Some projects with repos (partial)', () => (
    <TestableOverview
      stats={{
        ...baseStats,
        projectsWithReposCount: 3, // < totalProjects (6) → shows "Handoff all to" CompactSelect
        projectsWithAutomationCount: 2,
        projectsWithCreatePrCount: 1,
      }}
      isLoading={false}
    />
  ));

  // Code Review stories

  story('Code Review: No repos have code review enabled', () => (
    <TestableOverview
      stats={{
        ...baseStats,
        reposWithCodeReviewCount: 0, // seerRepoCount > 0 → ButtonBar visible, shows 0/10
      }}
      isLoading={false}
    />
  ));
});

import {Fragment, type ComponentProps} from 'react';

import * as Storybook from 'sentry/stories';
import type {
  IntegrationRepository,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {SCMOverviewSection} from 'sentry/views/settings/seer/overview/scmOverviewSection';

const GITHUB_INTEGRATION: OrganizationIntegration = {
  id: '1',
  name: 'my-org',
  icon: '',
  domainName: 'github.com/my-org',
  accountType: null,
  status: 'active',
  provider: {
    key: 'github',
    slug: 'github',
    name: 'GitHub',
    canAdd: true,
    canDisable: false,
    features: ['commits', 'issue-basic'],
    aspects: {},
  },
  configOrganization: [],
  configData: null,
  externalId: 'abc123',
  gracePeriodEnd: '',
  organizationId: '1',
  organizationIntegrationStatus: 'active',
};

const REPOS: IntegrationRepository[] = [
  {identifier: 'my-org/frontend', name: 'my-org/frontend', isInstalled: true},
  {identifier: 'my-org/backend', name: 'my-org/backend', isInstalled: true},
  {identifier: 'my-org/infra', name: 'my-org/infra', isInstalled: true},
];

const BASE_PROPS: ComponentProps<typeof SCMOverviewSection> = {
  canWrite: true,
  organizationSlug: 'my-org',
  isError: false,
  isPending: false,
  isReposPending: false,
  supportedScmIntegrations: [GITHUB_INTEGRATION],
  seerRepos: REPOS,
  connectedRepos: [],
  unconnectedRepos: REPOS.map(repo => ({repo, integration: GITHUB_INTEGRATION})),
  refetchIntegrations: () => {},
};

export default Storybook.story('SCMOverviewSection', story => {
  story('Overview', () => (
    <Fragment>
      <p>
        The <Storybook.JSXNode name="SCMOverviewSection" /> displays Source Code
        Management integration status in the Seer settings overview. It fetches SCM
        providers, installed integrations, and connected repositories to show a summary
        stat and actions.
      </p>
      <p>
        The component uses <code>useSCMOverviewSection()</code> to derive display state
        from <code>useScmIntegrationTreeData()</code>, then passes the result to{' '}
        <Storybook.JSXNode name="SCMOverviewSectionView" /> for rendering. The stories
        below exercise each visual state by passing controlled props directly to the view.
      </p>
    </Fragment>
  ));

  story('Loading', () => (
    <SCMOverviewSection
      {...BASE_PROPS}
      isPending
      supportedScmIntegrations={[]}
      seerRepos={[]}
      connectedRepos={[]}
      unconnectedRepos={[]}
    />
  ));

  story('Error', () => (
    <SCMOverviewSection
      {...BASE_PROPS}
      isError
      supportedScmIntegrations={[]}
      seerRepos={[]}
      connectedRepos={[]}
      unconnectedRepos={[]}
    />
  ));

  story('No supported integrations installed', () => (
    <SCMOverviewSection
      {...BASE_PROPS}
      supportedScmIntegrations={[]}
      seerRepos={[]}
      connectedRepos={[]}
      unconnectedRepos={[]}
    />
  ));

  story('Integration installed, provider has no accessible repos', () => (
    <SCMOverviewSection
      {...BASE_PROPS}
      seerRepos={[]}
      connectedRepos={[]}
      unconnectedRepos={[]}
    />
  ));

  story('Integration installed, 1 repo visible but none added to Sentry', () => (
    <SCMOverviewSection {...BASE_PROPS} seerRepos={REPOS.slice(0, 1)} />
  ));

  story('Integration installed, >1 repos visible but none added to Sentry', () => (
    <SCMOverviewSection {...BASE_PROPS} />
  ));

  story('Loading more repos', () => (
    <SCMOverviewSection
      {...BASE_PROPS}
      isReposPending
      connectedRepos={REPOS.slice(0, 1)}
      unconnectedRepos={REPOS.slice(1).map(repo => ({
        repo,
        isReposPending: true,
        integration: GITHUB_INTEGRATION,
      }))}
    />
  ));

  story('1 of 1 repo added', () => (
    <SCMOverviewSection
      {...BASE_PROPS}
      connectedRepos={REPOS.slice(0, 1)}
      unconnectedRepos={[]}
    />
  ));

  story('Some repos added', () => (
    <SCMOverviewSection
      {...BASE_PROPS}
      connectedRepos={REPOS.slice(0, 1)}
      unconnectedRepos={REPOS.slice(1).map(repo => ({
        repo,
        integration: GITHUB_INTEGRATION,
      }))}
    />
  ));

  story('All repos added', () => (
    <SCMOverviewSection {...BASE_PROPS} connectedRepos={REPOS} unconnectedRepos={[]} />
  ));

  story('Read-only (canWrite: false)', () => (
    <SCMOverviewSection
      {...BASE_PROPS}
      canWrite={false}
      connectedRepos={REPOS.slice(0, 1)}
      unconnectedRepos={REPOS.slice(1).map(repo => ({
        repo,
        integration: GITHUB_INTEGRATION,
      }))}
    />
  ));
});

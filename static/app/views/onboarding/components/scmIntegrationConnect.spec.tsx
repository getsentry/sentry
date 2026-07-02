import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Integration, Repository} from 'sentry/types/integrations';
import * as analytics from 'sentry/utils/analytics';

import {ScmIntegrationConnect} from './scmIntegrationConnect';

// Mock the virtualizer so all repo options render in JSDOM (no layout engine).
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: i * 36,
        size: 36,
      })),
    getTotalSize: () => count * 36,
    measureElement: jest.fn(),
  })),
}));

const githubGetsentry = OrganizationIntegrationsFixture({
  id: '1',
  name: 'getsentry',
  domainName: 'github.com/getsentry',
  provider: {
    key: 'github',
    slug: 'github',
    name: 'GitHub',
    canAdd: true,
    canDisable: false,
    features: ['commits'],
    aspects: {},
  },
});

const gitlabAcme = OrganizationIntegrationsFixture({
  id: '2',
  name: 'acme',
  domainName: 'gitlab.com/acme',
  provider: {
    key: 'gitlab',
    slug: 'gitlab',
    name: 'GitLab',
    canAdd: true,
    canDisable: false,
    features: ['commits'],
    aspects: {},
  },
});

interface HarnessProps {
  onClearDerivedState: jest.Mock;
  onIntegrationChange: jest.Mock;
  onRepositoryChange: jest.Mock;
}

// Stateful wrapper so onIntegrationChange actually updates selectedIntegration,
// mirroring how the real wizard owns this state. Without it the effective
// integration never changes and the switch path can't be exercised.
function Harness({
  onClearDerivedState,
  onIntegrationChange,
  onRepositoryChange,
}: HarnessProps) {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | undefined>(
    undefined
  );
  const [selectedRepository, setSelectedRepository] = useState<Repository | undefined>(
    undefined
  );

  return (
    <ScmIntegrationConnect
      analyticsFlow="project-creation"
      allowIntegrationSwitching
      selectedIntegration={selectedIntegration}
      selectedRepository={selectedRepository}
      onIntegrationChange={integration => {
        setSelectedIntegration(integration);
        onIntegrationChange(integration);
      }}
      onRepositoryChange={repository => {
        setSelectedRepository(repository);
        onRepositoryChange(repository);
      }}
      onClearDerivedState={onClearDerivedState}
    />
  );
}

describe('ScmIntegrationConnect', () => {
  const organization = OrganizationFixture();

  function mockEndpoints() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [githubGetsentry, gitlabAcme],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/1/repos/`,
      body: {repos: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/2/repos/`,
      body: {repos: []},
    });
  }

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('fires scm_connect_integration_selected with source=default for the auto-selected integration', async () => {
    mockEndpoints();
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

    render(
      <Harness
        onClearDerivedState={jest.fn()}
        onIntegrationChange={jest.fn()}
        onRepositoryChange={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByRole('button', {name: /getsentry/})).toBeInTheDocument();

    await waitFor(() =>
      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'project_creation.scm_connect_integration_selected',
        expect.objectContaining({provider: 'github', source: 'default'})
      )
    );
  });

  it('clears repo + derived state and fires source=manual when switching integration', async () => {
    mockEndpoints();
    const onClearDerivedState = jest.fn();
    const onIntegrationChange = jest.fn();
    const onRepositoryChange = jest.fn();
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

    render(
      <Harness
        onClearDerivedState={onClearDerivedState}
        onIntegrationChange={onIntegrationChange}
        onRepositoryChange={onRepositoryChange}
      />,
      {organization}
    );

    await userEvent.click(await screen.findByRole('button', {name: /getsentry/}));
    await userEvent.click(screen.getByRole('option', {name: 'acme'}));

    expect(onClearDerivedState).toHaveBeenCalledTimes(1);
    expect(onIntegrationChange).toHaveBeenCalledWith(gitlabAcme);
    expect(onRepositoryChange).toHaveBeenCalledWith(undefined);

    await waitFor(() =>
      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'project_creation.scm_connect_integration_selected',
        expect.objectContaining({provider: 'gitlab', source: 'manual'})
      )
    );
  });

  it('does not clear state or refire analytics when reselecting the active integration', async () => {
    mockEndpoints();
    const onClearDerivedState = jest.fn();
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

    render(
      <Harness
        onClearDerivedState={onClearDerivedState}
        onIntegrationChange={jest.fn()}
        onRepositoryChange={jest.fn()}
      />,
      {organization}
    );

    await userEvent.click(await screen.findByRole('button', {name: /getsentry/}));
    await userEvent.click(screen.getByRole('option', {name: 'getsentry'}));

    expect(onClearDerivedState).not.toHaveBeenCalled();

    const integrationSelectedCalls = trackAnalyticsSpy.mock.calls.filter(
      ([event]) => event === 'project_creation.scm_connect_integration_selected'
    );
    expect(integrationSelectedCalls).toHaveLength(1);
    expect(integrationSelectedCalls[0]![1]).toEqual(
      expect.objectContaining({source: 'default'})
    );
  });
});

import {GitLabIntegrationProviderFixture} from 'sentry-fixture/gitlabIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {NoIntegrationsEmptyState} from './noIntegrationsEmptyState';

describe('NoIntegrationsEmptyState', () => {
  it('allows users with integration access to install a provider', async () => {
    const organization = OrganizationFixture({access: ['org:read', 'org:integrations']});
    const initializePipeline = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/pipeline/integration_pipeline/',
      method: 'POST',
      body: {
        step: 'installation_config',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'gitlab',
        data: {},
      },
    });
    render(
      <NoIntegrationsEmptyState
        providers={[GitLabIntegrationProviderFixture()]}
        onAddIntegration={jest.fn()}
      />,
      {organization}
    );
    renderGlobalModal({organization});

    await userEvent.click(screen.getByRole('button', {name: 'Add integration'}));

    expect(await screen.findByText('Installing GitLab Integration')).toBeInTheDocument();
    await waitFor(() =>
      expect(initializePipeline).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({data: {action: 'initialize', provider: 'gitlab'}})
      )
    );
    expect(
      screen.queryByRole('button', {name: 'Request Installation'})
    ).not.toBeInTheDocument();
  });

  it('does not install unavailable providers even with integration access', async () => {
    render(
      <NoIntegrationsEmptyState
        providers={[GitLabIntegrationProviderFixture({canAdd: false})]}
        onAddIntegration={jest.fn()}
      />,
      {organization: OrganizationFixture({access: ['org:integrations']})}
    );
    renderGlobalModal();

    const connect = screen.getByRole('button', {name: 'Add integration'});
    expect(connect).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(connect);
    expect(screen.queryByText('Installing GitLab Integration')).not.toBeInTheDocument();
  });
});

import {IntegrationProviderFixture} from 'sentry-fixture/integrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import * as pipelineModal from 'sentry/components/pipeline/modal';
import {setupMockPopup} from 'sentry/components/pipeline/testUtils';
import {getSlackUpgradeModalParams} from 'sentry/utils/integrations/slackUpgradeModalParams';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

describe('AddIntegrationButton', () => {
  const provider = IntegrationProviderFixture();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([false, true])(
    'renders the Slack authorization flow with upgrade copy: %s',
    async isUpgrade => {
      const organization = OrganizationFixture();
      const slackProvider = IntegrationProviderFixture({key: 'slack', name: 'Slack'});
      setupMockPopup();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/pipeline/integration_pipeline/`,
        method: 'POST',
        body: {
          step: 'oauth_login',
          stepIndex: 0,
          totalSteps: 1,
          provider: 'slack',
          data: {oauthUrl: 'https://slack.com/oauth/authorize'},
        },
      });
      renderGlobalModal({organization});
      render(
        <AddIntegrationButton
          provider={slackProvider}
          organization={organization}
          onAddIntegration={jest.fn()}
          modalParams={
            isUpgrade
              ? getSlackUpgradeModalParams([
                  {key: 'seer_mentions', description: 'Server-provided Seer feature.'},
                ])
              : undefined
          }
        />,
        {organization}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Add integration'}));
      expect(
        await screen.findByText(
          isUpgrade ? 'Update Slack App Permissions' : 'Installing Slack Integration'
        )
      ).toBeInTheDocument();
      expect(
        await screen.findByText(
          isUpgrade
            ? /Server-provided Seer feature\./
            : 'Authorize your Slack account with Sentry to complete the integration setup.'
        )
      ).toBeInTheDocument();
      expect(window.open).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', {name: 'Authorize Slack'}));
      expect(window.open).toHaveBeenCalledWith(
        'https://slack.com/oauth/authorize',
        'pipeline_popup',
        expect.any(String)
      );
    }
  );

  it.each([{missingFeatures: undefined}, {missingFeatures: null}, {missingFeatures: []}])(
    'uses neutral upgrade instructions when missing features are unavailable (%#)',
    ({missingFeatures}) => {
      expect(getSlackUpgradeModalParams(missingFeatures)).toEqual({
        title: 'Update Slack App Permissions',
        description:
          'Reauthorize the Sentry app in your Slack workspace and accept the updated permissions to continue.',
      });
    }
  );

  it('opens the pipeline modal on click', async () => {
    const openPipelineModalSpy = jest
      .spyOn(pipelineModal, 'openPipelineModal')
      .mockImplementation(() => {});

    render(
      <AddIntegrationButton
        provider={provider}
        onAddIntegration={jest.fn()}
        organization={OrganizationFixture()}
      />
    );

    await userEvent.click(screen.getByLabelText('Add integration'));

    expect(openPipelineModalSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration',
        provider: provider.key,
        onComplete: expect.any(Function),
      })
    );
  });
});

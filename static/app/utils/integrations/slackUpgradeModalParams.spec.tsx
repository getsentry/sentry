import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderGlobalModal, screen, within} from 'sentry-test/reactTestingLibrary';

import {openPipelineModal} from 'sentry/components/pipeline/modal';

import {getSlackUpgradeModalParams} from './slackUpgradeModalParams';

const instructions =
  'Reauthorize the Sentry app in your Slack workspace and accept the updated permissions to continue.';

function openSlackUpgrade(
  missingFeatures: Parameters<typeof getSlackUpgradeModalParams>[0]
) {
  const organization = OrganizationFixture();
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/pipeline/integration_pipeline/`,
    method: 'POST',
    body: {
      step: 'oauth_login',
      stepIndex: 0,
      totalSteps: 1,
      provider: 'slack',
      data: {oauthUrl: 'https://slack.com/oauth/v2/authorize'},
    },
  });
  renderGlobalModal({organization});
  act(() => {
    openPipelineModal({
      type: 'integration',
      provider: 'slack',
      ...getSlackUpgradeModalParams(missingFeatures),
    });
  });
}

describe('Slack upgrade modal', () => {
  it('renders each missing feature as a separate list item', async () => {
    const features = [
      {
        key: 'seer_mentions',
        description:
          'Seer in Slack: Responds when you mention @Sentry to ask questions and investigate issues.',
      },
      {key: 'another_feature', description: 'Another server-provided feature.'},
    ];
    openSlackUpgrade(features);

    expect(await screen.findByRole('button', {name: 'Authorize Slack'})).toBeEnabled();
    expect(screen.getByText('Update Slack App Permissions')).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    features.forEach((feature, index) => {
      expect(items[index]).toHaveTextContent(feature.description);
    });
    expect(screen.getByText(instructions)).toBeInTheDocument();
  });

  it.each([undefined, null, []])(
    'keeps neutral copy without features (%p)',
    async features => {
      openSlackUpgrade(features);

      expect(await screen.findByRole('button', {name: 'Authorize Slack'})).toBeEnabled();
      expect(screen.getByText(instructions)).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryByText(/missing permissions for/)).not.toBeInTheDocument();
    }
  );
});

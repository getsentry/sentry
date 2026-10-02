import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import * as analytics from 'sentry/utils/analytics';
import {useMessagingIntegrationAlertRule} from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

describe('useMessagingIntegrationAlertRule change analytics', () => {
  const organization = OrganizationFixture();
  const slackA = OrganizationIntegrationsFixture({name: "Moo Deng's Workspace"});
  const slackB = OrganizationIntegrationsFixture({name: "Moo Waan's Workspace"});
  const discord = OrganizationIntegrationsFixture({name: "Moo Deng's Server"});

  function renderRule(variant?: 'scm' | 'legacy') {
    return renderHookWithProviders(
      () =>
        useMessagingIntegrationAlertRule(
          {
            actions: [],
            integration: slackA,
            provider: 'slack',
            providersToIntegrations: {slack: [slackA, slackB], discord: [discord]},
            queryError: false,
            querySuccess: true,
            shouldRenderSetupButton: false,
            setActions: jest.fn(),
            setChannel: jest.fn(),
            setIntegration: jest.fn(),
            setProvider: jest.fn(),
          },
          variant
        ),
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackA.id}/channels/`,
      body: {results: []},
    });
  });

  it('fires notify_*_changed with the variant when set', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const {result} = renderRule('scm');

    result.current.onProviderChange({value: 'discord'});
    result.current.onIntegrationChange({value: slackB});
    result.current.onChannelChange({label: '#general', value: '1'});

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.notify_provider_changed',
      expect.objectContaining({provider: 'discord', variant: 'scm'})
    );
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.notify_integration_changed',
      expect.objectContaining({variant: 'scm'})
    );
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.notify_channel_changed',
      expect.objectContaining({variant: 'scm'})
    );
  });

  it('tracks custom channel creation with the variant', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const {result} = renderRule('legacy');

    result.current.onCreateChannel('#custom-channel');

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.notify_channel_changed',
      expect.objectContaining({variant: 'legacy'})
    );
  });

  it('fires nothing when variant is undefined (shared alerts rule-creation caller)', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const {result} = renderRule(undefined);

    result.current.onProviderChange({value: 'discord'});
    result.current.onChannelChange({label: '#general', value: '1'});

    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'project_creation.notify_provider_changed',
      expect.anything()
    );
    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'project_creation.notify_channel_changed',
      expect.anything()
    );
  });

  it('does not track custom channel creation without a variant', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const {result} = renderRule(undefined);

    result.current.onCreateChannel('#custom-channel');

    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'project_creation.notify_channel_changed',
      expect.anything()
    );
  });
});

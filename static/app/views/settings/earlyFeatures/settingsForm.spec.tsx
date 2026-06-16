import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EarlyFeaturesSettingsForm} from 'sentry/views/settings/earlyFeatures/settingsForm';

describe('EarlyFeaturesSettingsForm', () => {
  const organization = OrganizationFixture({access: ['org:write']});
  const featureFlags = {
    'organizations:my-flag': {
      description: 'My feature flag',
      value: false,
    },
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/internal/feature-flags/',
      body: featureFlags,
    });
  });

  it('renders flags with their current values', async () => {
    render(<EarlyFeaturesSettingsForm access={new Set(organization.access)} />, {
      organization,
    });

    const toggle = await screen.findByRole('checkbox', {name: 'My feature flag'});
    expect(toggle).not.toBeChecked();
  });

  it('updates a flag when toggled and can toggle it back after a successful save', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: '/internal/feature-flags/',
      method: 'PUT',
    });

    render(<EarlyFeaturesSettingsForm access={new Set(organization.access)} />, {
      organization,
    });

    const toggle = await screen.findByRole('checkbox', {name: 'My feature flag'});
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(putMock).toHaveBeenNthCalledWith(
        1,
        '/internal/feature-flags/',
        expect.objectContaining({
          method: 'PUT',
          data: {'organizations:my-flag': true},
        })
      );
    });

    await userEvent.click(toggle);

    await waitFor(() => {
      expect(putMock).toHaveBeenNthCalledWith(
        2,
        '/internal/feature-flags/',
        expect.objectContaining({
          method: 'PUT',
          data: {'organizations:my-flag': false},
        })
      );
    });
  });
});

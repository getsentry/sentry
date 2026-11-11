import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DataForwarderProviderSlug, type DataForwarder} from './util/types';
import OrganizationDataForwardingSetup from './setup';

const organization = OrganizationFixture({features: ['data-forwarding']});

function dataForwarder(provider: DataForwarderProviderSlug): DataForwarder {
  return {
    id: provider,
    provider,
    config: {},
    enrollNewProjects: false,
    enrolledProjects: [],
    isEnabled: true,
    organizationId: organization.id,
    projectConfigs: [],
  };
}

describe('OrganizationDataForwardingSetup', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
  });

  it.each([
    {scenario: 'all providers available', providers: []},
    {
      scenario: 'only Splunk available',
      providers: [DataForwarderProviderSlug.SEGMENT, DataForwarderProviderSlug.SQS],
    },
  ])('shows the selected Splunk form with $scenario', async ({providers}) => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/forwarding/`,
      body: providers.map(dataForwarder),
    });
    render(<OrganizationDataForwardingSetup />, {organization});

    await waitFor(() => {
      const disabledTabs = screen
        .getAllByRole('tab')
        .filter(tab => tab.getAttribute('aria-disabled') === 'true');
      expect(disabledTabs).toHaveLength(providers.length);
    });
    const splunk = await screen.findByRole('tab', {name: 'Splunk'});
    expect(splunk).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('textbox', {name: 'Instance URL'})).not.toBeInTheDocument();
    await userEvent.click(splunk);

    expect(await screen.findByRole('textbox', {name: 'Instance URL'})).toBeEnabled();
  });
});

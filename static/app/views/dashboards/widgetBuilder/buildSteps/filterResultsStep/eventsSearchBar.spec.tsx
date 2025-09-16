import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';

import {EventsSearchBar} from './eventsSearchBar';

jest.mock('sentry/utils/useCustomMeasurements');

describe('EventsSearchBar', () => {
  let organization: Organization;
  beforeEach(() => {
    organization = OrganizationFixture();
    jest.mocked(useCustomMeasurements).mockReturnValue({customMeasurements: {}});
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/recent-searches/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/recent-searches/`,
      body: [],
      method: 'POST',
    });
  });

  it('does not show function tags in has: dropdown', async () => {
    render(
      <EventsSearchBar
        onClose={jest.fn()}
        dataset={DiscoverDatasets.TRANSACTIONS}
        pageFilters={PageFiltersFixture()}
        widgetQuery={{
          aggregates: ['count_unique(browser.name)'],
          columns: [],
          conditions: '',
          name: '',
          orderby: '',
          fieldAliases: undefined,
          fields: undefined,
          isHidden: undefined,
          onDemand: undefined,
          selectedAggregate: undefined,
        }}
      />,
      {
        organization,
      }
    );

    // Focus the input and type "has:p" to simulate a search for p50
    const input = await screen.findByRole('combobox', {name: 'Add a search term'});
    await userEvent.type(input, 'has:p');

    // Check that "p50" (a function tag) is NOT in the dropdown
    let listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByText('p50')).not.toBeInTheDocument();

    await userEvent.type(input, '{Enter}');

    // Check that a selected aggregate is in the dropdown
    await userEvent.clear(input);
    await userEvent.type(input, 'count_uni');

    listbox = await screen.findByRole('listbox');
    await within(listbox).findByText('count_unique(...)');

    await userEvent.type(input, '{Enter}');

    // Check that a normal tag (e.g. "transaction") IS in the dropdown
    await userEvent.clear(input);
    await userEvent.type(input, 'transact');

    listbox = await screen.findByRole('listbox');
    await within(listbox).findByText('transaction');
    await userEvent.type(input, '{Enter}');
  });
});

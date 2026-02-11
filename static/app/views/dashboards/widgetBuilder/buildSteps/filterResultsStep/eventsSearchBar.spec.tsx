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
    expect(
      within(screen.getByRole('listbox')).queryByText('p50')
    ).not.toBeInTheDocument();
  });

  it('shows the selected aggregate in the dropdown', async () => {
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

    const input = await screen.findByRole('combobox', {name: 'Add a search term'});

    await userEvent.type(input, 'count_uni');

    expect(
      await within(screen.getByRole('listbox')).findByText('count_unique(...)')
    ).toBeInTheDocument();
  });

  it('shows normal tags, e.g. transaction, in the dropdown', async () => {
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

    const input = await screen.findByRole('combobox', {name: 'Add a search term'});
    await userEvent.clear(input);
    await userEvent.type(input, 'transact');

    expect(
      await within(screen.getByRole('listbox')).findByRole('option', {
        name: 'transaction',
      })
    ).toBeInTheDocument();
  });
});

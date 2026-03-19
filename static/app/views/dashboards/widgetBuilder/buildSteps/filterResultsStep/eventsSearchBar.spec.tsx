import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useCustomMeasurements} from 'sentry/utils/useCustomMeasurements';

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

    const input = await screen.findByRole('combobox', {name: 'Add a search term'});
    await userEvent.click(input, {delay: null});
    await userEvent.paste('has:p', {delay: null});

    await userEvent.click(
      screen.getByRole('button', {name: 'Edit value for filter: has'})
    );

    // Assert we actually have has: dropdown options before checking exclusions.
    expect(await screen.findByRole('option', {name: 'environment'})).toBeInTheDocument();

    // p50 is a function and should not be suggested as a has: tag.
    expect(screen.queryByRole('option', {name: 'p50'})).not.toBeInTheDocument();
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
    await userEvent.click(input);
    await userEvent.paste('count_uni', {delay: null});

    expect(
      await within(await screen.findByRole('listbox')).findByText('count_unique(...)')
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
    await userEvent.click(input, {delay: null});
    await userEvent.paste('transact', {delay: null});

    expect(
      await within(await screen.findByRole('listbox')).findByRole('option', {
        name: 'transaction',
      })
    ).toBeInTheDocument();
  });
});
// trivial change for CI testing

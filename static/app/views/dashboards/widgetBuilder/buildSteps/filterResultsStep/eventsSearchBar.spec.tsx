import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {FieldKind} from 'sentry/utils/fields';
import {useCustomMeasurements} from 'sentry/utils/useCustomMeasurements';

import {EventsSearchBar} from './eventsSearchBar';

jest.mock('sentry/utils/useCustomMeasurements');

describe('EventsSearchBar', () => {
  let organization: Organization;
  beforeEach(() => {
    jest.useFakeTimers();
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
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/tags/`,
      body: [
        {key: 'environment', name: 'environment', kind: FieldKind.FIELD},
        {key: 'transaction', name: 'transaction', kind: FieldKind.FIELD},
      ],
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('does not show function tags in has: dropdown', async () => {
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

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
    await user.click(input);
    await user.paste('has:p');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await user.click(
      await screen.findByRole('button', {name: 'Edit value for filter: has'})
    );

    expect(await screen.findByRole('option', {name: 'environment'})).toBeInTheDocument();

    expect(screen.queryByRole('option', {name: 'p50'})).not.toBeInTheDocument();
  });

  it('shows the selected aggregate in the dropdown', async () => {
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

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
    await user.click(input);
    await user.paste('count_uni');

    expect(
      await within(await screen.findByRole('listbox')).findByText('count_unique(...)')
    ).toBeInTheDocument();
  });

  it('shows normal tags, e.g. transaction, in the dropdown', async () => {
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

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
    await user.clear(input);
    await user.click(input);
    await user.paste('transact');

    expect(
      await within(await screen.findByRole('listbox')).findByRole('option', {
        name: 'transaction',
      })
    ).toBeInTheDocument();
  });
});

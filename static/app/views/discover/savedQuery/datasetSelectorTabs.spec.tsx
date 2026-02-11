import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView, {type EventViewOptions} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DatasetSelectorTabs} from 'sentry/views/discover/savedQuery/datasetSelectorTabs';

const EVENT_VIEW_CONSTRUCTOR_PROPS: EventViewOptions = {
  createdBy: undefined,
  end: undefined,
  environment: [],
  fields: [{field: 'transaction'}, {field: 'project'}],
  name: 'Test',
  project: [],
  query: 'foo:bar',
  start: undefined,
  team: [],
  sorts: [],
  statsPeriod: undefined,
  topEvents: undefined,
  id: undefined,
  display: undefined,
};

describe('Discover DatasetSelector', () => {
  const organization = OrganizationFixture({features: ['performance-view']});

  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/discover/results/',
    },
  };

  it('renders tabs', () => {
    const eventView = new EventView(EVENT_VIEW_CONSTRUCTOR_PROPS);
    render(
      <DatasetSelectorTabs
        isHomepage={false}
        savedQuery={undefined}
        eventView={eventView}
      />,
      {
        organization,
        initialRouterConfig,
      }
    );
    expect(screen.getByRole('tab', {name: 'Errors'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Transactions'})).toBeInTheDocument();
  });

  it('pushes compatible query', async () => {
    const eventView = new EventView({
      createdBy: undefined,
      end: undefined,
      environment: [],
      fields: [
        {field: 'transaction'},
        {field: 'project'},
        {field: 'count_unique(error.handled)'},
        {field: 'error.mechanism'},
      ],
      name: 'Test',
      project: [],
      query: '(error.type:bar AND project:foo)',
      start: undefined,
      team: [],
      sorts: [{field: 'error.mechanism', kind: 'asc'}],
      statsPeriod: undefined,
      topEvents: undefined,
      id: undefined,
      display: undefined,
    });
    const {router} = render(
      <DatasetSelectorTabs
        isHomepage={false}
        savedQuery={undefined}
        eventView={eventView}
      />,
      {
        organization,
        initialRouterConfig,
      }
    );
    await userEvent.click(screen.getByRole('tab', {name: 'Transactions'}));
    expect(router.location).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['transaction', 'project'],
          query: 'project:foo',
          queryDataset: 'transaction-like',
          sort: '-transaction',
          incompatible: 'true',
        }),
      })
    );
  });

  it('only updates dataset if saved query', async () => {
    const eventView = new EventView({
      ...EVENT_VIEW_CONSTRUCTOR_PROPS,
      dataset: DiscoverDatasets.ERRORS,
      id: '1',
    });
    const {router} = render(
      <DatasetSelectorTabs
        isHomepage={false}
        savedQuery={undefined}
        eventView={eventView}
      />,
      {
        organization,
        initialRouterConfig,
      }
    );
    await userEvent.click(screen.getByRole('tab', {name: 'Transactions'}));
    expect(router.location).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['transaction', 'project'],
          query: 'foo:bar',
          queryDataset: 'transaction-like',
        }),
      })
    );
  });

  it('tooltip for transactions dataset if org has deprecation feature', async () => {
    const eventView = new EventView({
      ...EVENT_VIEW_CONSTRUCTOR_PROPS,
      dataset: DiscoverDatasets.ERRORS,
      id: '1',
    });

    const org = OrganizationFixture({
      features: ['performance-view', 'discover-saved-queries-deprecation'],
    });

    render(
      <DatasetSelectorTabs
        isHomepage={false}
        savedQuery={undefined}
        eventView={eventView}
      />,
      {
        organization: org,
        initialRouterConfig,
      }
    );

    await userEvent.hover(screen.getByRole('tab', {name: 'Transactions'}));
    expect(
      await screen.findByText(
        /Discover\u2192Transactions is going to be merged into Explore\u2192Traces soon/i
      )
    ).toBeInTheDocument();
  });
});

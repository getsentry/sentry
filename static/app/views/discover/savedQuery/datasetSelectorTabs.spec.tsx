import {initializeOrg} from 'sentry-test/initializeOrg';
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

describe('Discover DatasetSelector', function () {
  const {router} = initializeOrg({
    organization: {features: ['performance-view']},
  });

  it('renders tabs', function () {
    const eventView = new EventView(EVENT_VIEW_CONSTRUCTOR_PROPS);
    render(
      <DatasetSelectorTabs
        isHomepage={false}
        savedQuery={undefined}
        eventView={eventView}
      />,
      {
        router,
      }
    );
    expect(screen.getByRole('tab', {name: 'Errors'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Transactions'})).toBeInTheDocument();
  });

  it('pushes new default event view if not a saved query', async function () {
    const eventView = new EventView(EVENT_VIEW_CONSTRUCTOR_PROPS);
    render(
      <DatasetSelectorTabs
        isHomepage={false}
        savedQuery={undefined}
        eventView={eventView}
      />,
      {
        router,
      }
    );
    await userEvent.click(screen.getByRole('tab', {name: 'Transactions'}));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          project: undefined,
          field: ['transaction', 'project'],
          query: 'foo:bar',
          queryDataset: 'transaction-like',
        }),
      })
    );
  });

  it('only updates dataset if saved query', async function () {
    const eventView = new EventView({
      ...EVENT_VIEW_CONSTRUCTOR_PROPS,
      dataset: DiscoverDatasets.ERRORS,
      id: '1',
    });
    render(
      <DatasetSelectorTabs
        isHomepage={false}
        savedQuery={undefined}
        eventView={eventView}
      />,
      {
        router,
      }
    );
    await userEvent.click(screen.getByRole('tab', {name: 'Transactions'}));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          project: undefined,
          field: ['transaction', 'project'],
          query: 'foo:bar',
          queryDataset: 'transaction-like',
        }),
      })
    );
  });
});

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView, {type EventViewOptions} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DatasetSelector} from 'sentry/views/discover/savedQuery/datasetSelector';

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

  it('renders selector and options', async function () {
    const eventView = new EventView(EVENT_VIEW_CONSTRUCTOR_PROPS);
    render(
      <DatasetSelector isHomepage={false} savedQuery={undefined} eventView={eventView} />,
      {
        router,
      }
    );
    await userEvent.click(screen.getByText('Dataset'));
    const menuOptions = await screen.findAllByRole('option');
    expect(menuOptions.map(e => e.textContent)).toEqual([
      'Errors',
      'Transactions',
      'Unknown',
    ]);
  });

  it('pushes new dafault event view if not a saved query', async function () {
    const eventView = new EventView(EVENT_VIEW_CONSTRUCTOR_PROPS);
    render(
      <DatasetSelector isHomepage={false} savedQuery={undefined} eventView={eventView} />,
      {
        router,
      }
    );
    await userEvent.click(screen.getByText('Dataset'));
    await userEvent.click(screen.getByRole('option', {name: 'Transactions'}));
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
      <DatasetSelector isHomepage={false} savedQuery={undefined} eventView={eventView} />,
      {
        router,
      }
    );
    await userEvent.click(screen.getByText('Dataset'));
    await userEvent.click(screen.getByRole('option', {name: 'Transactions'}));
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

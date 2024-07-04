import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {DatasetSelector} from 'sentry/views/discover/savedQuery/datasetSelector';

const EVENT_VIEW_CONSTRUCTOR_PROPS = {
  createdBy: undefined,
  end: undefined,
  environment: [],
  fields: [],
  name: undefined,
  project: [],
  query: '',
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
    expect(menuOptions.map(e => e.textContent)).toEqual(['Errors', 'Transactions']);
  });

  it('pushes new event view', async function () {
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
          project: [],
          field: ['title', 'project', 'user.display', 'timestamp'],
          query: 'event.type:transaction',
          queryDataset: 'transaction-like',
        }),
      })
    );
  });
});

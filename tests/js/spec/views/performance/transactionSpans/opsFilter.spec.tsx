import {Location} from 'history';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'app/utils/discover/eventView';
import OpsFilter from 'app/views/performance/transactionSummary/transactionSpans/opsFilter';

function initializeData({query} = {query: {}}) {
  const features = ['performance-view', 'performance-suspect-spans-view'];
  // @ts-expect-error
  const organization = TestStubs.Organization({
    features,
    // @ts-expect-error
    projects: [TestStubs.Project()],
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: 'Test Transaction',
          project: '1',
          ...query,
        },
      },
    },
  });
  return initialData;
}

function createEventView(location: Location) {
  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: '',
      fields: ['count()'],
      projects: [],
    },
    location
  );
}

describe('Performance > Transaction Spans', function () {
  it('fetches span ops', async function () {
    // @ts-expect-error
    const eventsSpanOpsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-span-ops/',
      body: [{op: 'op1'}, {op: 'op2'}],
    });

    const initialData = initializeData();

    mountWithTheme(
      <OpsFilter
        location={initialData.router.location}
        eventView={createEventView(initialData.router.location)}
        organization={initialData.organization}
        handleOpChange={() => {}}
        transactionName="Test Transaction"
      />,
      {context: initialData.routerContext}
    );

    expect(eventsSpanOpsMock).toHaveBeenCalledTimes(1);

    expect(await screen.findByTestId('span-op-filter-header')).toBeInTheDocument();

    const filterItems = await screen.findAllByTestId('span-op-filter-item');
    expect(filterItems).toHaveLength(2);
    filterItems.forEach(item => expect(item).toBeInTheDocument());
  });

  it('handles op change correctly', async function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-span-ops/',
      body: [{op: 'op1'}, {op: 'op2'}],
    });

    const initialData = initializeData();

    const handleOpChange = jest.fn();

    mountWithTheme(
      <OpsFilter
        location={initialData.router.location}
        eventView={createEventView(initialData.router.location)}
        organization={initialData.organization}
        handleOpChange={handleOpChange}
        transactionName="Test Transaction"
      />,
      {context: initialData.routerContext}
    );

    expect(handleOpChange).not.toHaveBeenCalled();
    const item = (await screen.findByText('op1')).closest('li');
    expect(item).toBeInTheDocument();
    fireEvent.click(item!);
    expect(handleOpChange).toHaveBeenCalledTimes(1);
    expect(handleOpChange).toHaveBeenCalledWith('op1');
  });
});

import {Location} from 'history';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import OpsFilter from 'sentry/views/performance/transactionSummary/transactionSpans/opsFilter';

function initializeData({query} = {query: {}}) {
  const features = ['performance-view'];
  const organization = Organization({
    features,
    projects: [ProjectFixture()],
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
    project: {},
    projects: [],
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
    const eventsSpanOpsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-span-ops/',
      body: [{op: 'op1'}, {op: 'op2'}],
    });

    const initialData = initializeData();

    render(
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

    (await screen.findByRole('button', {name: 'Filter'})).click();
    expect(await screen.findByText('op1')).toBeInTheDocument();
    expect(await screen.findByText('op2')).toBeInTheDocument();
  });

  it('handles op change correctly', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-span-ops/',
      body: [{op: 'op1'}, {op: 'op2'}],
    });

    const initialData = initializeData();

    const handleOpChange = jest.fn();

    render(
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
    (await screen.findByRole('button', {name: 'Filter'})).click();
    const item = await screen.findByText('op1');
    expect(item).toBeInTheDocument();
    await userEvent.click(item!);
    expect(handleOpChange).toHaveBeenCalledTimes(1);
    expect(handleOpChange).toHaveBeenCalledWith('op1');
  });

  it('shows op being filtered on', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-span-ops/',
      body: [{op: 'op1'}, {op: 'op2'}],
    });

    const initialData = initializeData({query: {spanOp: 'op1'}});

    const handleOpChange = jest.fn();

    render(
      <OpsFilter
        location={initialData.router.location}
        eventView={createEventView(initialData.router.location)}
        organization={initialData.organization}
        handleOpChange={handleOpChange}
        transactionName="Test Transaction"
      />,
      {context: initialData.routerContext}
    );

    expect(await screen.findByRole('button', {name: 'op1'})).toBeInTheDocument();
  });
});

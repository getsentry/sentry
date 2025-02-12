import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import OpsFilter from 'sentry/views/performance/transactionSummary/transactionSpans/opsFilter';

function initializeData({query} = {query: {}}) {
  const features = ['performance-view'];
  const organization = OrganizationFixture({features});
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
      {router: initialData.router}
    );

    expect(eventsSpanOpsMock).toHaveBeenCalledTimes(1);

    await userEvent.click(await screen.findByRole('button', {name: 'Filter'}));
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
      {router: initialData.router}
    );

    expect(handleOpChange).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', {name: 'Filter'}));
    const item = await screen.findByText('op1');
    expect(item).toBeInTheDocument();
    await userEvent.click(item);
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
      {router: initialData.router}
    );

    expect(await screen.findByRole('button', {name: 'op1'})).toBeInTheDocument();
  });
});

import selectEvent from 'react-select-event';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import TransactionThresholdModal from 'sentry/views/performance/transactionSummary/transactionThresholdModal';

const stubEl = props => <div>{props.children}</div>;

function mountModal(eventView, organization, onApply) {
  render(
    <TransactionThresholdModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      eventView={eventView}
      organization={organization}
      transactionName="transaction/threshold"
      transactionThreshold="400"
      transactionThresholdMetric="lcp"
      onApply={onApply}
      closeModal={() => void 0}
    />
  );
}

describe('TransactionThresholdModal', function () {
  const organization = TestStubs.Organization({features: ['performance-view']});
  const project = TestStubs.Project();
  const eventView = new EventView({
    id: '1',
    name: 'my query',
    fields: [{field: 'count()'}],
    sorts: [{field: 'count', kind: 'desc'}],
    query: '',
    project: [project.id],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: [],
  });

  const onApply = jest.fn();
  let postTransactionThresholdMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
    postTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'POST',
      body: {
        data: [],
      },
    });
  });

  it('can update threshold', function () {
    mountModal(eventView, organization, onApply);

    userEvent.clear(screen.getByRole('spinbutton'));
    userEvent.type(screen.getByRole('spinbutton'), '1000{enter}');

    userEvent.click(screen.getByTestId('apply-threshold'));

    expect(postTransactionThresholdMock).toHaveBeenCalledWith(
      '/organizations/org-slug/project-transaction-threshold-override/',
      expect.objectContaining({
        data: {metric: 'lcp', threshold: '1000', transaction: 'transaction/threshold'},
      })
    );
  });

  it('can update metric', async function () {
    mountModal(eventView, organization, onApply);

    await selectEvent.select(
      screen.getByText('Largest Contentful Paint'),
      'Transaction Duration'
    );

    userEvent.click(screen.getByTestId('apply-threshold'));

    expect(postTransactionThresholdMock).toHaveBeenCalledWith(
      '/organizations/org-slug/project-transaction-threshold-override/',
      expect.objectContaining({
        data: {
          metric: 'duration',
          threshold: '400',
          transaction: 'transaction/threshold',
        },
      })
    );
  });

  it('can clear metrics', async function () {
    mountModal(eventView, organization, onApply);

    const deleteTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'DELETE',
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });

    userEvent.click(screen.getByTestId('reset-all'));

    expect(deleteTransactionThresholdMock).toHaveBeenCalledTimes(1);
    // Replace with project fallback
    await waitFor(() => {
      expect(getProjectThresholdMock).toHaveBeenCalledTimes(1);
    });
  });
});

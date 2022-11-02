import selectEvent from 'react-select-event';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import TransactionThresholdModal, {
  TransactionThresholdMetric,
} from 'sentry/views/performance/transactionSummary/transactionThresholdModal';

function mountModal(
  eventView: EventView,
  organization: Organization,
  onApply: React.ComponentProps<typeof TransactionThresholdModal>['onApply']
) {
  render(
    <TransactionThresholdModal
      Body={ModalBody}
      closeModal={jest.fn()}
      CloseButton={makeCloseButton(jest.fn())}
      Header={makeClosableHeader(jest.fn())}
      Footer={ModalFooter}
      eventView={eventView}
      organization={organization}
      transactionName="transaction/threshold"
      transactionThreshold={400}
      transactionThresholdMetric={TransactionThresholdMetric.LARGEST_CONTENTFUL_PAINT}
      onApply={onApply}
    />
  );
}

describe('TransactionThresholdModal', function () {
  const organization = TestStubs.Organization({features: ['performance-view']});
  const project = TestStubs.Project();
  const eventView = EventView.fromSavedQuery({
    id: '1',
    version: 2,
    name: 'my query',
    fields: ['count()'],
    orderby: '-count',
    query: '',
    projects: [project.id],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    environment: [],
  });

  const onApply = jest.fn();
  let postTransactionThresholdMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
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
          threshold: 400,
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

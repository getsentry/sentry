import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByLabel} from 'sentry-test/select-new';

import ProjectsStore from 'app/stores/projectsStore';
import EventView from 'app/utils/discover/eventView';
import TransactionThresholdModal from 'app/views/performance/transactionSummary/transactionThresholdModal';

const stubEl = props => <div>{props.children}</div>;

async function clickSubmit(wrapper) {
  // Click on submit.
  const button = wrapper.find('Button[data-test-id="apply-threshold"] button');
  button.simulate('click');
  return tick();
}

async function clickReset(wrapper) {
  // Click on submit.
  const button = wrapper.find('Button[data-test-id="reset-all"] button');
  button.simulate('click');
  return tick();
}

function mountModal(eventView, organization, onApply) {
  return mountWithTheme(
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
    ProjectsStore.loadInitialData([project]);
    postTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'POST',
      body: {
        data: [],
      },
    });
  });

  it('can update threshold', async function () {
    const wrapper = mountModal(eventView, organization, onApply);
    await tick();
    wrapper.update();

    const input = wrapper.find('Input[name="threshold"]');
    input.simulate('change', {target: {value: '1000'}}).simulate('blur');

    await clickSubmit(wrapper);
    expect(postTransactionThresholdMock).toHaveBeenCalledWith(
      '/organizations/org-slug/project-transaction-threshold-override/',
      expect.objectContaining({
        data: {metric: 'lcp', threshold: '1000', transaction: 'transaction/threshold'},
      })
    );
    wrapper.unmount();
  });

  it('can update metric', async function () {
    const wrapper = mountModal(eventView, organization, onApply);
    await tick();
    wrapper.update();

    selectByLabel(wrapper, 'Transaction Duration', {
      name: 'responseMetric',
      at: 0,
      control: true,
    });
    expect(wrapper.find('input[name="responseMetric"]').props().value).toEqual(
      'duration'
    );

    await clickSubmit(wrapper);
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
    wrapper.unmount();
  });

  it('can clear metrics', async function () {
    const wrapper = mountModal(eventView, organization, onApply);
    await tick();
    wrapper.update();

    expect(wrapper.find('input[name="responseMetric"]').props().value).toEqual('lcp');
    expect(wrapper.find('input[name="threshold"]').props().value).toEqual('400');

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

    await clickReset(wrapper);
    wrapper.update();
    expect(deleteTransactionThresholdMock).toHaveBeenCalledTimes(1);
    // Replace with project fallback
    expect(getProjectThresholdMock).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});

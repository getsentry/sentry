import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import TransactionThresholdButton from 'sentry/views/performance/transactionSummary/transactionThresholdButton';

function mountComponent(eventView, organization, onChangeThreshold) {
  return mountWithTheme(
    <TransactionThresholdButton
      eventView={eventView}
      organization={organization}
      transactionName="transaction/threshold"
      onChangeThreshold={onChangeThreshold}
    />
  );
}

describe('TransactionThresholdButton', function () {
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
  const onChangeThreshold = jest.fn();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
  });

  it('renders element correctly', async function () {
    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {
        threshold: '800',
        metric: 'lcp',
      },
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });
    const wrapper = mountComponent(eventView, organization, onChangeThreshold);
    await tick();
    wrapper.update();

    const button = wrapper.find('Button');
    expect(button.prop('disabled')).toBeFalsy();
    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
    expect(getProjectThresholdMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('gets project threshold if transaction threshold does not exist', async function () {
    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      statusCode: 404,
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });
    const wrapper = mountComponent(eventView, organization, onChangeThreshold);
    await tick();
    wrapper.update();

    const button = wrapper.find('Button');
    expect(button.prop('disabled')).toBeFalsy();
    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
    expect(getProjectThresholdMock).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('mounts modal with the right values', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {
        threshold: '800',
        metric: 'lcp',
      },
    });

    const wrapper = mountComponent(eventView, organization, onChangeThreshold);
    await tick();
    wrapper.update();

    expect(
      wrapper.find('TransactionThresholdButton').state('transactionThreshold')
    ).toEqual('800');
    expect(
      wrapper.find('TransactionThresholdButton').state('transactionThresholdMetric')
    ).toEqual('lcp');

    const spy = jest.spyOn(ModalStore, 'openModal');
    const button = wrapper.find('Button');
    button.simulate('click');

    await tick();
    wrapper.update();

    expect(spy).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {fetchOrganizationEnvironments} from 'sentry/actionCreators/environments';
import {Client} from 'sentry/api';
import OrganizationEnvironmentsStore from 'sentry/stores/organizationEnvironmentsStore';
import GroupEventDetailsContainer, {
  GroupEventDetailsProps,
} from 'sentry/views/organizationGroupDetails/groupEventDetails';
import {ReprocessingStatus} from 'sentry/views/organizationGroupDetails/utils';

jest.mock(
  'sentry/views/organizationGroupDetails/groupEventDetails/groupEventDetails',
  () => () => <div>GroupEventDetails</div>
);

const makeProps = (props: Partial<GroupEventDetailsProps>): GroupEventDetailsProps => {
  const mergedProps: GroupEventDetailsProps = {
    event: TestStubs.Event(),
    eventError: false,
    group: TestStubs.Group(),
    loadingEvent: false,
    onRetry: () => null,
    groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
    organization: TestStubs.Organization(),
    project: TestStubs.Project(),
    params: {groupId: '0', orgId: '0', eventId: '0'},
    ...props,
  } as GroupEventDetailsProps;

  return mergedProps;
};

describe('groupEventDetailsContainer', () => {
  const organization = TestStubs.Organization();

  beforeEach(() => {
    OrganizationEnvironmentsStore.init();
  });

  it('fetches environments', async function () {
    const environmentsCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });

    fetchOrganizationEnvironments(new Client(), organization.slug);
    render(<GroupEventDetailsContainer {...makeProps({organization})} />);
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(environmentsCall).toHaveBeenCalledTimes(1);
  });

  it('displays an error on error', async function () {
    const environmentsCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      statusCode: 400,
    });

    fetchOrganizationEnvironments(new Client(), organization.slug);
    render(<GroupEventDetailsContainer {...makeProps({organization})} />);

    expect(
      await screen.findByText(
        "There was an error loading your organization's environments"
      )
    ).toBeInTheDocument();
    expect(environmentsCall).toHaveBeenCalledTimes(1);
  });

  it('displays an error on falsey environment', async function () {
    const environmentsCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: null,
    });
    fetchOrganizationEnvironments(new Client(), organization.slug);
    render(<GroupEventDetailsContainer {...makeProps({organization})} />);

    expect(
      await screen.findByText(
        "There was an error loading your organization's environments"
      )
    ).toBeInTheDocument();
    expect(environmentsCall).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', async function () {
    const unsubscribeMock = jest.fn();
    jest
      .spyOn(OrganizationEnvironmentsStore, 'listen')
      .mockImplementation(() => unsubscribeMock);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });
    fetchOrganizationEnvironments(new Client(), organization.slug);
    const {unmount} = render(
      <GroupEventDetailsContainer {...makeProps({organization})} />
    );
    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();

    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });
});

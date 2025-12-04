import {Fragment} from 'react';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {mockTour} from 'sentry/components/tours/testUtils';
import ConfigStore from 'sentry/stores/configStore';
import ModalStore from 'sentry/stores/modalStore';
import {GroupStatus, IssueCategory} from 'sentry/types/group';
import * as analytics from 'sentry/utils/analytics';
import {GroupActions} from 'sentry/views/issueDetails/actions';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

const project = ProjectFixture({
  id: '2448',
  name: 'project name',
  slug: 'project',
});

const group = GroupFixture({
  id: '1337',
  pluginActions: [],
  pluginIssues: [],
  issueCategory: IssueCategory.ERROR,
  project,
});

const issuePlatformGroup = GroupFixture({
  id: '1338',
  issueCategory: IssueCategory.FEEDBACK,
  project,
});

const organization = OrganizationFixture({
  id: '4660',
  slug: 'org',
});

jest.mock('sentry/views/issueDetails/issueDetailsTour', () => ({
  ...jest.requireActual('sentry/views/issueDetails/issueDetailsTour'),
  useIssueDetailsTour: () => mockTour(),
}));

describe('GroupActions', () => {
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  beforeEach(() => {
    ConfigStore.init();
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  describe('render()', () => {
    it('renders correctly', async () => {
      render(
        <GroupActions group={group} project={project} disabled={false} event={null} />,
        {
          organization,
        }
      );
      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    });
  });

  describe('subscribing', () => {
    let issuesApi: any;
    beforeEach(() => {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: GroupFixture({isSubscribed: false}),
      });
    });

    it('can subscribe', async () => {
      render(
        <GroupActions group={group} project={project} disabled={false} event={null} />,
        {
          organization,
        }
      );
      await userEvent.click(screen.getByRole('button', {name: 'Subscribe'}));

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isSubscribed: true},
        })
      );
    });
  });

  describe('bookmarking', () => {
    let issuesApi: any;

    beforeEach(() => {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: GroupFixture({isBookmarked: false}),
      });
    });

    it('can bookmark', async () => {
      render(
        <GroupActions group={group} project={project} disabled={false} event={null} />,
        {
          organization,
        }
      );

      await userEvent.click(screen.getByLabelText('More Actions'));

      const bookmark = await screen.findByTestId('bookmark');
      await userEvent.click(bookmark);

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isBookmarked: true},
        })
      );
    });
  });

  describe('reprocessing', () => {
    it('renders ReprocessAction component if org has native exception event', async () => {
      const event = EventStacktraceExceptionFixture({
        platform: 'native',
      });

      render(
        <GroupActions group={group} project={project} event={event} disabled={false} />,
        {
          organization,
        }
      );

      await userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
    });

    it('open dialog by clicking on the ReprocessAction component', async () => {
      const event = EventStacktraceExceptionFixture({
        platform: 'native',
      });

      render(
        <GroupActions group={group} project={project} event={event} disabled={false} />,
        {
          organization,
        }
      );

      const onReprocessEventFunc = jest.spyOn(ModalStore, 'openModal');

      await userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
      await userEvent.click(reprocessActionButton);
      await waitFor(() => expect(onReprocessEventFunc).toHaveBeenCalled());
    });
  });

  describe('delete', () => {
    it('opens delete confirm modal from more actions dropdown', async () => {
      const org = OrganizationFixture({
        ...organization,
        access: [...organization.access, 'event:admin'],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/issues/`,
        method: 'PUT',
        body: {},
      });
      const deleteMock = MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/issues/`,
        method: 'DELETE',
        body: {},
      });
      const initialRouterConfig = {
        location: {
          pathname: `/organizations/${org.slug}/issues/${group.id}/`,
        },
        route: `/organizations/:orgId/issues/:groupId/`,
      };
      const {router} = render(
        <Fragment>
          <GlobalModal />
          <GroupActions group={group} project={project} disabled={false} event={null} />
        </Fragment>,
        {
          organization: org,
          initialRouterConfig,
        }
      );

      await userEvent.click(screen.getByLabelText('More Actions'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

      const modal = screen.getByRole('dialog');
      expect(
        within(modal).getByText(/Deleting this issue is permanent/)
      ).toBeInTheDocument();

      await userEvent.click(within(modal).getByRole('button', {name: 'Delete'}));

      expect(deleteMock).toHaveBeenCalled();
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${org.slug}/issues/`,
          query: {project: project.id},
        })
      );
    });

    it('delete for issue platform', async () => {
      const org = OrganizationFixture({
        ...organization,
        access: [...organization.access, 'event:admin'],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/issues/`,
        method: 'PUT',
        body: {},
      });
      const deleteMock = MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/issues/`,
        method: 'DELETE',
        body: {},
      });
      const initialRouterConfig = {
        location: {
          pathname: `/organizations/${org.slug}/issues/${issuePlatformGroup.id}/`,
        },
        route: `/organizations/:orgId/issues/:groupId/`,
      };
      const {router} = render(
        <Fragment>
          <GlobalModal />
          <GroupActions
            group={issuePlatformGroup}
            project={project}
            disabled={false}
            event={null}
          />
        </Fragment>,
        {
          organization: org,
          initialRouterConfig,
        }
      );

      await userEvent.click(screen.getByLabelText('More Actions'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

      const modal = screen.getByRole('dialog');
      expect(
        within(modal).getByText(/Deleting this issue is permanent/)
      ).toBeInTheDocument();

      await userEvent.click(within(modal).getByRole('button', {name: 'Delete'}));

      expect(deleteMock).toHaveBeenCalled();
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${org.slug}/issues/`,
          query: {project: project.id},
        })
      );
    });
  });

  it('resolves and unresolves issue', async () => {
    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project/issues/`,
      method: 'PUT',
      body: {...group, status: 'resolved'},
    });

    const {rerender} = render(
      <GroupActions group={group} project={project} disabled={false} event={null} />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

    expect(issuesApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );
    expect(analyticsSpy).toHaveBeenCalledWith(
      'issue_details.action_clicked',
      expect.objectContaining({
        action_type: 'resolved',
      })
    );

    rerender(
      <GroupActions
        group={{...group, status: GroupStatus.RESOLVED, statusDetails: {}}}
        project={project}
        disabled={false}
        event={null}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Unresolve'}));

    expect(issuesApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project/issues/`,
      expect.objectContaining({
        data: {status: 'unresolved', statusDetails: {}, substatus: 'ongoing'},
      })
    );
  });

  it('can archive issue', async () => {
    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project/issues/`,
      method: 'PUT',
      body: {...group, status: 'resolved'},
    });

    render(
      <GroupActions group={group} project={project} disabled={false} event={null} />,
      {
        organization,
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Archive'}));

    expect(issuesApi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          status: 'ignored',
          statusDetails: {},
          substatus: 'archived_until_escalating',
        },
      })
    );
    expect(analyticsSpy).toHaveBeenCalledWith(
      'issue_details.action_clicked',
      expect.objectContaining({
        action_substatus: 'archived_until_escalating',
        action_type: 'ignored',
      })
    );
  });

  it('refetches group data after resolve action using useGroup hook', async () => {
    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project/issues/`,
      method: 'PUT',
      body: {...group, status: 'resolved'},
    });

    // Mock the group fetch API that useGroup hook will call
    const groupFetchApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'GET',
      body: group,
    });

    function GroupActionsWrapper() {
      const {data: groupData, isLoading} = useGroup({groupId: group.id});

      if (isLoading || !groupData) {
        return <div>Loading...</div>;
      }

      return (
        <GroupActions group={groupData} project={project} disabled={false} event={null} />
      );
    }

    render(<GroupActionsWrapper />, {organization});

    await waitFor(() => {
      expect(groupFetchApi).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

    expect(issuesApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );

    // Verify that the group is fetched a second time after the action to refresh data
    await waitFor(() => {
      expect(groupFetchApi).toHaveBeenCalledTimes(2);
    });
  });
});

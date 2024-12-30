import {Fragment} from 'react';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import ConfigStore from 'sentry/stores/configStore';
import ModalStore from 'sentry/stores/modalStore';
import {GroupStatus, IssueCategory} from 'sentry/types/group';
import * as analytics from 'sentry/utils/analytics';
import GroupActions from 'sentry/views/issueDetails/actions';

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
  issueCategory: IssueCategory.PERFORMANCE,
  project,
});

const organization = OrganizationFixture({
  id: '4660',
  slug: 'org',
});

describe('GroupActions', function () {
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  beforeEach(function () {
    ConfigStore.init();
  });
  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  describe('render()', function () {
    it('renders correctly', async function () {
      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          disabled={false}
          event={null}
        />
      );
      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    });
  });

  describe('subscribing', function () {
    let issuesApi: any;
    beforeEach(function () {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: GroupFixture({isSubscribed: false}),
      });
    });

    it('can subscribe', async function () {
      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          disabled={false}
          event={null}
        />
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

  describe('bookmarking', function () {
    let issuesApi: any;

    beforeEach(function () {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: GroupFixture({isBookmarked: false}),
      });
    });

    it('can bookmark', async function () {
      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          disabled={false}
          event={null}
        />
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

  describe('reprocessing', function () {
    it('renders ReprocessAction component if org has native exception event', async function () {
      const event = EventStacktraceExceptionFixture({
        platform: 'native',
      });

      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          event={event}
          disabled={false}
        />
      );

      await userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
    });

    it('open dialog by clicking on the ReprocessAction component', async function () {
      const event = EventStacktraceExceptionFixture({
        platform: 'native',
      });

      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          event={event}
          disabled={false}
        />
      );

      const onReprocessEventFunc = jest.spyOn(ModalStore, 'openModal');

      await userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
      await userEvent.click(reprocessActionButton);
      await waitFor(() => expect(onReprocessEventFunc).toHaveBeenCalled());
    });
  });

  it('opens share modal from more actions dropdown', async () => {
    const org = {
      ...organization,
      features: ['shared-issues'],
    };

    render(
      <Fragment>
        <GlobalModal />
        <GroupActions
          group={group}
          project={project}
          organization={org}
          disabled={false}
          event={null}
        />
      </Fragment>,
      {organization: org}
    );

    await userEvent.click(screen.getByLabelText('More Actions'));
    await userEvent.click(await screen.findByText('Share'));

    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('Share Issue')).toBeInTheDocument();
  });

  describe('delete', function () {
    it('opens delete confirm modal from more actions dropdown', async () => {
      const router = RouterFixture();
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
      render(
        <Fragment>
          <GlobalModal />
          <GroupActions
            group={group}
            project={project}
            organization={org}
            disabled={false}
            event={null}
          />
        </Fragment>,
        {router, organization: org}
      );

      await userEvent.click(screen.getByLabelText('More Actions'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

      const modal = screen.getByRole('dialog');
      expect(
        within(modal).getByText(/Deleting this issue is permanent/)
      ).toBeInTheDocument();

      await userEvent.click(within(modal).getByRole('button', {name: 'Delete'}));

      expect(deleteMock).toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith({
        pathname: `/organizations/${org.slug}/issues/`,
        query: {project: project.id},
      });
    });

    it('delete for issue platform', async () => {
      const org = OrganizationFixture({
        access: ['event:admin'], // Delete is only shown if this is present
      });
      render(
        <GroupActions
          group={issuePlatformGroup}
          project={project}
          organization={org}
          disabled={false}
          event={null}
        />,
        {organization: org}
      );

      await userEvent.click(screen.getByLabelText('More Actions'));
      expect(await screen.findByTestId('delete-issue')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(await screen.findByTestId('delete-and-discard')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
    it('delete for issue platform is enabled with feature flag', async () => {
      const org = OrganizationFixture({
        access: ['event:admin'],
        features: ['issue-platform-deletion-ui'],
      });
      render(
        <GroupActions
          group={issuePlatformGroup}
          project={project}
          organization={org}
          disabled={false}
          event={null}
        />,
        {organization: org}
      );

      await userEvent.click(screen.getByLabelText('More Actions'));
      expect(await screen.findByTestId('delete-issue')).not.toHaveAttribute(
        'aria-disabled'
      );
      expect(await screen.findByTestId('delete-and-discard')).toHaveAttribute(
        'aria-disabled',
        'true'
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
      <GroupActions
        group={group}
        project={project}
        organization={organization}
        disabled={false}
        event={null}
      />,
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
        organization={organization}
        disabled={false}
        event={null}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Resolved'}));

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
      <GroupActions
        group={group}
        project={project}
        organization={organization}
        disabled={false}
        event={null}
      />,
      {organization}
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
});

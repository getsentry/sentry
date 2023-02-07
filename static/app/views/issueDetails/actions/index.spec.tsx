import {Fragment} from 'react';
import {browserHistory} from 'react-router';

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
import {IssueCategory} from 'sentry/types';
import GroupActions from 'sentry/views/issueDetails/actions';

const project = TestStubs.ProjectDetails({
  id: '2448',
  name: 'project name',
  slug: 'project',
});

const group = TestStubs.Group({
  id: '1337',
  pluginActions: [],
  pluginIssues: [],
  issueCategory: IssueCategory.ERROR,
  project,
});

const organization = TestStubs.Organization({
  id: '4660',
  slug: 'org',
  features: ['reprocessing-v2'],
});

describe('GroupActions', function () {
  beforeEach(function () {
    ConfigStore.init();
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => []);
    MockApiClient.clearMockResponses();
  });

  describe('render()', function () {
    it('renders correctly', function () {
      const wrapper = render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          disabled={false}
        />
      );
      expect(wrapper.container).toSnapshot();
    });
  });

  describe('subscribing', function () {
    let issuesApi: any;
    beforeEach(function () {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: TestStubs.Group({isSubscribed: false}),
      });
    });

    it('can subscribe', function () {
      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          disabled={false}
        />
      );
      userEvent.click(screen.getByRole('button', {name: 'Subscribe'}));

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
        body: TestStubs.Group({isBookmarked: false}),
      });
    });

    it('can bookmark', async function () {
      render(
        <GroupActions
          group={group}
          project={project}
          organization={organization}
          disabled={false}
        />
      );

      userEvent.click(screen.getByLabelText('More Actions'));

      const bookmark = await screen.findByTestId('bookmark');
      userEvent.click(bookmark);

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isBookmarked: true},
        })
      );
    });
  });

  describe('reprocessing', function () {
    it('renders ReprocessAction component if org has feature flag reprocessing-v2 and native exception event', async function () {
      const event = TestStubs.EventStacktraceException({
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

      userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
    });

    it('open dialog by clicking on the ReprocessAction component', async function () {
      const event = TestStubs.EventStacktraceException({
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

      userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
      userEvent.click(reprocessActionButton);
      await waitFor(() => expect(onReprocessEventFunc).toHaveBeenCalled());
    });
  });

  it('opens share modal from more actions dropdown', async () => {
    const org = {
      ...organization,
      features: ['shared-issues'],
    };

    const updateMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'PUT',
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
        />
      </Fragment>,
      {organization: org}
    );

    userEvent.click(screen.getByLabelText('More Actions'));
    userEvent.click(await screen.findByText('Share'));

    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('Share Issue')).toBeInTheDocument();
    expect(updateMock).toHaveBeenCalled();
  });

  it('opens delete confirm modal from more actions dropdown', async () => {
    const org = {
      ...organization,
      access: [...organization.access, 'event:admin'],
    };
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
        />
      </Fragment>,
      {organization: org}
    );

    userEvent.click(screen.getByLabelText('More Actions'));
    userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

    const modal = screen.getByRole('dialog');
    expect(
      within(modal).getByText(/Deleting this issue is permanent/)
    ).toBeInTheDocument();

    userEvent.click(within(modal).getByRole('button', {name: 'Delete'}));

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {project: project.id},
    });
  });

  it('resolves and unresolves issue', () => {
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
      />,
      {organization}
    );

    userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

    expect(issuesApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project/issues/`,
      expect.objectContaining({data: {status: 'resolved', statusDetails: {}}})
    );

    rerender(
      <GroupActions
        group={{...group, status: 'resolved'}}
        project={project}
        organization={organization}
        disabled={false}
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Resolved'}));

    expect(issuesApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project/issues/`,
      expect.objectContaining({data: {status: 'unresolved', statusDetails: {}}})
    );
  });
});

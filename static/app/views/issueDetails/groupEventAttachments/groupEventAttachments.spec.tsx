import {EnvironmentsFixture} from 'sentry-fixture/environments';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import ModalStore from 'sentry/stores/modalStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';

import GroupEventAttachments from './groupEventAttachments';

describe('GroupEventAttachments', function () {
  const groupId = 'group-id';
  const group = GroupFixture({id: groupId});
  const {organization, router} = initializeOrg({
    organization: {
      features: ['event-attachments'],
      orgRole: 'member',
      attachmentsRole: 'member',
    },
  });
  const {router: screenshotRouter} = initializeOrg({
    router: {
      params: {orgId: 'org-slug', groupId: 'group-id'},
      location: {query: {attachmentFilter: 'screenshot'}},
    },
  });
  let project: Project;
  let getAttachmentsMock: jest.Mock;

  beforeEach(function () {
    project = ProjectFixture({platform: 'apple-ios'});
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: EnvironmentsFixture(),
    });
    getAttachmentsMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${groupId}/attachments/`,
      body: [EventAttachmentFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('calls attachments api with screenshot filter', async function () {
    render(<GroupEventAttachments project={project} group={group} />, {
      router: screenshotRouter,
      organization,
    });
    expect(screen.getByRole('radio', {name: 'Screenshots'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', {name: 'Screenshots'}));
    expect(getAttachmentsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/group-id/attachments/',
      expect.objectContaining({
        query: {screenshot: '1'},
      })
    );
  });

  it('calls opens modal when clicking on panel body', async function () {
    render(<GroupEventAttachments project={project} group={group} />, {
      router: screenshotRouter,
      organization,
    });
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('screenshot-1'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('links event id to event detail', async function () {
    render(<GroupEventAttachments project={project} group={group} />, {
      router,
      organization,
    });
    expect(await screen.findByRole('link', {name: '12345678'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/group-id/events/12345678901234567890123456789012/'
    );
  });

  it('links to the download URL', async function () {
    render(<GroupEventAttachments project={project} group={group} />, {
      router: screenshotRouter,
      organization,
    });
    await userEvent.click(await screen.findByLabelText('Actions'));
    expect(
      await screen.findByRole('menuitemradio', {name: 'Download'})
    ).toBeInTheDocument();
  });

  it('displays error message when request fails', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/attachments/',
      statusCode: 500,
    });
    render(<GroupEventAttachments project={project} group={group} />, {
      router,
      organization,
    });
    expect(await screen.findByText(/error loading/i)).toBeInTheDocument();
  });

  it('can delete an attachment', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/12345678901234567890123456789012/attachments/1/',
      method: 'DELETE',
    });
    render(<GroupEventAttachments project={project} group={group} />, {
      router,
      organization,
    });
    renderGlobalModal();

    expect(await screen.findByText('12345678')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(
      await screen.findByText('Are you sure you wish to delete this file?')
    ).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Delete'})
    );

    expect(deleteMock).toHaveBeenCalled();
    expect(screen.queryByText('12345678')).not.toBeInTheDocument();
  });

  it('filters by date/query when using Streamlined UI', function () {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [parseInt(project.id, 10)],
        environments: ['staging'],
        datetime: {
          period: '3d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );

    const testRouter = RouterFixture();
    testRouter.location.query = {
      query: 'user.email:leander.rodrigues@sentry.io',
    };
    render(<GroupEventAttachments project={project} group={group} />, {
      router: testRouter,
      organization: {...organization, features: ['issue-details-streamline-enforce']},
    });
    expect(getAttachmentsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/group-id/attachments/',
      expect.objectContaining({
        query: {
          environment: ['staging'],
          query: 'user.email:leander.rodrigues@sentry.io',
          statsPeriod: '3d',
        },
      })
    );
  });
});

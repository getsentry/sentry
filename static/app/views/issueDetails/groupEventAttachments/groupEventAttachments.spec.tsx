import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {ProjectFixture} from 'sentry-fixture/project';

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
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';

import GroupEventAttachments from './groupEventAttachments';

describe('GroupEventAttachments', function () {
  const groupId = 'group-id';
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

    getAttachmentsMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${groupId}/attachments/`,
      body: [EventAttachmentFixture()],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('calls attachments api with screenshot filter', async function () {
    render(<GroupEventAttachments project={project} groupId={groupId} />, {
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

  it('does not render screenshots tab if not mobile platform', function () {
    project.platform = 'javascript';
    render(<GroupEventAttachments project={project} groupId={groupId} />, {
      router: screenshotRouter,
      organization,
    });
    expect(screen.queryByText('Screenshots')).not.toBeInTheDocument();
  });

  it('calls opens modal when clicking on panel body', async function () {
    render(<GroupEventAttachments project={project} groupId={groupId} />, {
      router: screenshotRouter,
      organization,
    });
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('screenshot-1'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('links event id to event detail', async function () {
    render(<GroupEventAttachments project={project} groupId={groupId} />, {
      router,
      organization,
    });
    expect(await screen.findByRole('link', {name: '12345678'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/group-id/events/12345678901234567890123456789012/'
    );
  });

  it('links to the download URL', async function () {
    render(<GroupEventAttachments project={project} groupId={groupId} />, {
      router: screenshotRouter,
      organization,
    });
    await userEvent.click(await screen.findByLabelText('Actions'));
    expect(screen.getByText('Download').closest('a')).toHaveAttribute(
      'href',
      '/api/0/projects/org-slug/project-slug/events/12345678901234567890123456789012/attachments/1/?download=1'
    );
  });

  it('displays error message when request fails', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/attachments/',
      statusCode: 500,
    });
    render(<GroupEventAttachments project={project} groupId={groupId} />, {
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
    render(<GroupEventAttachments project={project} groupId={groupId} />, {
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
});

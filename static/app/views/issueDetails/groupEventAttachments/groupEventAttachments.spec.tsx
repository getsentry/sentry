import {EventAttachment} from 'sentry-fixture/eventAttachment';
import {Organization} from 'sentry-fixture/organization';
import {Project} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';

import GroupEventAttachments, {MAX_SCREENSHOTS_PER_PAGE} from './groupEventAttachments';

jest.mock('sentry/actionCreators/modal');

describe('GroupEventAttachments > Screenshots', function () {
  const {organization, routerContext} = initializeOrg({
    organization: Organization(),
    router: {
      params: {orgId: 'org-slug', groupId: 'group-id'},
      location: {query: {types: 'event.screenshot'}},
    },
  } as Parameters<typeof initializeOrg>[0]);
  let project;
  let getAttachmentsMock;

  beforeEach(function () {
    project = Project({platform: 'apple-ios'});
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    getAttachmentsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/attachments/',
      body: [EventAttachment()],
    });
  });

  afterEach(() => {});

  function renderGroupEventAttachments() {
    return render(<GroupEventAttachments project={project} />, {
      context: routerContext,
      organization,
    });
  }

  it('calls attachments api with screenshot filter', async function () {
    renderGroupEventAttachments();
    expect(screen.getByRole('radio', {name: 'Screenshots'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', {name: 'Screenshots'}));
    expect(getAttachmentsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/group-id/attachments/',
      expect.objectContaining({
        query: {per_page: MAX_SCREENSHOTS_PER_PAGE, screenshot: 1, types: undefined},
      })
    );
  });

  it('does not render screenshots tab if not mobile platform', function () {
    project.platform = 'javascript';
    renderGroupEventAttachments();
    expect(screen.queryByText('Screenshots')).not.toBeInTheDocument();
  });

  it('calls opens modal when clicking on panel body', async function () {
    renderGroupEventAttachments();
    await userEvent.click(await screen.findByTestId('screenshot-1'));
    expect(openModal).toHaveBeenCalled();
  });

  it('links event id to event detail', async function () {
    renderGroupEventAttachments();
    expect(
      (await screen.findByText('12345678901234567890123456789012')).closest('a')
    ).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/group-id/events/12345678901234567890123456789012/'
    );
  });

  it('links to the download URL', async function () {
    renderGroupEventAttachments();
    await userEvent.click(await screen.findByLabelText('Actions'));
    expect(screen.getByText('Download').closest('a')).toHaveAttribute(
      'href',
      '/api/0/projects/org-slug/project-slug/events/12345678901234567890123456789012/attachments/1/?download=1'
    );
  });

  it('displays an error message when request fails', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/attachments/',
      statusCode: 500,
    });
    renderGroupEventAttachments();
    expect(await screen.findByText(/error loading/i)).toBeInTheDocument();
  });
});

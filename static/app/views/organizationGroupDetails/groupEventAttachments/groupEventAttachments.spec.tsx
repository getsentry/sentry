import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';

import GroupEventAttachments from './groupEventAttachments';

jest.mock('sentry/actionCreators/modal');

describe('GroupEventAttachments > Screenshots', function () {
  const {organization, routerContext} = initializeOrg({
    organization: TestStubs.Organization({features: ['mobile-screenshot-gallery']}),
    router: {
      params: {orgId: 'org-slug', groupId: 'group-id'},
      location: {query: {types: 'event.screenshot'}},
    },
  } as Parameters<typeof initializeOrg>[0]);
  let project;
  let getAttachmentsMock;

  beforeEach(function () {
    project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    getAttachmentsMock = MockApiClient.addMockResponse({
      url: '/issues/group-id/attachments/',
      body: [TestStubs.EventAttachment()],
    });
  });

  afterEach(() => {});

  function renderGroupEventAttachments() {
    return render(<GroupEventAttachments projectSlug={project.slug} />, {
      context: routerContext,
      organization,
    });
  }

  it('calls attachments api with screenshot filter', function () {
    renderGroupEventAttachments();
    expect(screen.getByText('Screenshots')).toBeInTheDocument();
    userEvent.click(screen.getByText('Screenshots'));
    expect(getAttachmentsMock).toHaveBeenCalledWith(
      '/issues/group-id/attachments/',
      expect.objectContaining({
        query: {per_page: 6, screenshot: 1, types: undefined},
      })
    );
  });

  it('calls opens modal when clicking on panel body', function () {
    renderGroupEventAttachments();
    userEvent.click(screen.getByTestId('screenshot-1'));
    expect(openModal).toHaveBeenCalled();
  });

  it('links event id to event detail', function () {
    renderGroupEventAttachments();
    expect(
      screen.getByText('12345678901234567890123456789012').closest('a')
    ).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/group-id/events/12345678901234567890123456789012/'
    );
  });

  it('links to the download URL', function () {
    renderGroupEventAttachments();
    userEvent.click(screen.getByLabelText('Actions'));
    expect(screen.getByText('Download').closest('a')).toHaveAttribute(
      'href',
      '/api/0/projects/org-slug/project-slug/events/12345678901234567890123456789012/attachments/1/?download=1'
    );
  });
});

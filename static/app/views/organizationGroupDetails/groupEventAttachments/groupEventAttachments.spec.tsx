import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';

import GroupEventAttachments from './groupEventAttachments';

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
      body: [
        {
          id: '3808101758',
          name: 'screenshot.png',
          headers: {
            'Content-Type': 'image/png',
          },
          mimetype: 'image/png',
          size: 84235,
          sha1: '207960ce8056f3cde048720d30a3959a6692fbef',
          dateCreated: '2022-09-12T09:27:30.512445Z',
          type: 'event.attachment',
          event_id: '55cc19fb18114dd88cc91a5f29ccbd10',
        },
      ],
    });
  });

  afterEach(() => {});

  function renderGroupEventAttachments() {
    return render(<GroupEventAttachments projectSlug={project.slug} />, {
      context: routerContext,
      organization,
    });
  }

  it('calls attachments api with screenshot filter', async function () {
    renderGroupEventAttachments();
    expect(screen.getByText('Screenshots')).toBeInTheDocument();
    userEvent.click(screen.getByText('Screenshots'));
    await waitFor(() => {
      expect(getAttachmentsMock).toHaveBeenCalledWith(
        '/issues/group-id/attachments/',
        expect.objectContaining({
          query: {limit: 6, screenshot: 1, types: undefined},
        })
      );
    });
  });
});

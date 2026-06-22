import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {IssuePreviewDrawer} from 'sentry/views/issueDetails/issuePreview/issuePreviewDrawer';

describe('IssuePreviewDrawer', () => {
  it('renders the issue short ID and title', async () => {
    const project = ProjectFixture();
    const group = GroupFixture({
      id: '123',
      shortId: 'JAVASCRIPT-6QS',
      project,
      metadata: {type: 'RequestError', title: 'ReferenceError: foo is not defined'},
    });

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/replay-count/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      body: [],
    });

    render(<IssuePreviewDrawer groupId={group.id} />);

    expect(await screen.findByText('JAVASCRIPT-6QS')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'ReferenceError: foo is not defined'})
    ).toBeInTheDocument();
  });

  it('builds badge links from the group context, not the route param', async () => {
    const project = ProjectFixture();
    const group = GroupFixture({id: '123', shortId: 'JAVASCRIPT-6QS', project});

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/attachments/`,
      body: [
        {
          id: '1',
          name: 'screenshot.png',
          headers: {'Content-Type': 'image/png'},
          mimetype: 'image/png',
          size: 100,
          sha1: 'abc',
          dateCreated: '2024-01-01T00:00:00Z',
          type: 'event.attachment',
          event_id: 'abc123',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/replay-count/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      body: [],
    });

    render(<IssuePreviewDrawer groupId={group.id} />);

    const attachmentsLink = await screen.findByRole('button', {
      name: "View this issue's attachments",
    });
    expect(attachmentsLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/123/attachments/'
    );
  });
});

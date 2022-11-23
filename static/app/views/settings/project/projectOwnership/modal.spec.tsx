import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectOwnershipModal from './modal';

describe('Project Ownership', () => {
  const org = TestStubs.Organization();
  const project = TestStubs.ProjectDetails();
  const issueId = '1234';

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/issues/${issueId}/tags/url/`,
      body: {
        key: 'url',
        name: 'URL',
        uniqueValues: 1,
        totalValues: 1,
        topValues: [
          {
            key: 'url',
            name: 'https://example.com/path',
            value: 'https://example.com/path',
            count: 1,
            lastSeen: '2022-08-27T03:24:53Z',
            firstSeen: '2022-08-27T03:24:53Z',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/ownership/`,
      body: {
        fallthrough: false,
        autoAssignment: 'Auto Assign to Suspect Commits',
        codeownersAutoSync: false,
        raw: null,
      },
    });
    const stacktrace = TestStubs.EventEntryStacktrace();
    // Set one frame to in-app
    stacktrace.data.frames[0].inApp = true;
    MockApiClient.addMockResponse({
      url: `/issues/${issueId}/events/latest/`,
      body: TestStubs.Event({
        entries: [stacktrace],
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      body: TestStubs.Members(),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders stacktrace suggestions', () => {
    render(
      <ProjectOwnershipModal
        issueId={issueId}
        organization={org}
        project={project}
        onSave={() => {}}
      />
    );

    expect(screen.getByText(/Match against Issue Data/)).toBeInTheDocument();
    // First in-app frame is suggested
    expect(screen.getByText('raven/base.py')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/path')).toBeInTheDocument();
  });
});

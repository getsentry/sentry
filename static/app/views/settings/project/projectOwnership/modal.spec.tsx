import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import ProjectOwnershipModal from './modal';

describe('Project Ownership', () => {
  const org = TestStubs.Organization();
  const project = TestStubs.ProjectDetails();
  const issueId = '1234';
  const stacktrace = TestStubs.EventEntryStacktrace();
  const event = TestStubs.Event({
    entries: [stacktrace],
  });
  const user = TestStubs.User();

  beforeEach(() => {
    ConfigStore.set('user', user);
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
    // Set one frame to in-app
    stacktrace.data.frames[0].inApp = true;
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
        eventData={event}
        onCancel={() => {}}
      />
    );

    // Rule builder
    expect(screen.getByLabelText('Rule pattern')).toBeInTheDocument();

    expect(screen.getByText(/Match against Issue Data/)).toBeInTheDocument();
    // First in-app (default reverse order) frame is suggested
    expect(screen.getByText('raven/base.py')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/path')).toBeInTheDocument();
  });

  it('renders streamline-targeting-context suggestions', () => {
    render(
      <ProjectOwnershipModal
        issueId={issueId}
        organization={{...org, features: ['streamline-targeting-context']}}
        project={project}
        eventData={event}
        onCancel={() => {}}
      />
    );

    // Description
    expect(screen.getByText(/Assign issues based on custom rules/)).toBeInTheDocument();

    // Suggestions
    expect(
      screen.getByText(/Here’s some suggestions based on this issue/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`path:raven/base.py ${user.email}`, {exact: false})
    ).toBeInTheDocument();
    expect(
      screen.getByText(`url:*/path ${user.email}`, {exact: false})
    ).toBeInTheDocument();

    // Rule builder hidden TODO: remove when streamline-targeting-context is GA
    expect(screen.queryByLabelText('Rule pattern')).not.toBeInTheDocument();
  });

  it('can cancel', async () => {
    const onCancel = jest.fn();
    render(
      <ProjectOwnershipModal
        issueId={issueId}
        organization={org}
        project={project}
        eventData={event}
        onCancel={onCancel}
      />
    );

    // Cancel
    await userEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});

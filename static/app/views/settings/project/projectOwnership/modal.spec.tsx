import {EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {MembersFixture} from 'sentry-fixture/members';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import ProjectOwnershipModal from './modal';

describe('Project Ownership', () => {
  const org = OrganizationFixture();
  const project = ProjectFixture();
  const issueId = '1234';
  const stacktrace = EventEntryStacktraceFixture();
  const event = EventFixture({
    entries: [stacktrace],
  });
  const user = UserFixture();

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
    stacktrace.data.frames![0]!.inApp = true;
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      body: MembersFixture(),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders stacktrace suggestions', async () => {
    render(
      <ProjectOwnershipModal
        issueId={issueId}
        organization={org}
        project={project}
        eventData={event}
        onCancel={() => {}}
      />
    );

    // Description
    expect(
      await screen.findByText(/Assign issues based on custom rules/)
    ).toBeInTheDocument();

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
    await userEvent.click(await screen.findByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('still renders if 404 error occurs', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${issueId}/tags/url/`,
      statusCode: 404,
    });

    render(
      <ProjectOwnershipModal
        issueId={issueId}
        organization={org}
        project={project}
        eventData={event}
        onCancel={() => {}}
      />
    );

    expect(
      await screen.findByText(/Assign issues based on custom rules/)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Here’s some suggestions based on this issue/)
    ).toBeInTheDocument();
  });

  it('does not render if any other error status occurs', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${issueId}/tags/url/`,
      statusCode: 401,
    });

    render(
      <ProjectOwnershipModal
        issueId={issueId}
        organization={org}
        project={project}
        eventData={event}
        onCancel={() => {}}
      />
    );

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});

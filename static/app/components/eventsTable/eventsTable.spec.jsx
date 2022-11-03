import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventsTable from 'sentry/components/eventsTable/eventsTable';
import ProjectsStore from 'sentry/stores/projectsStore';

jest.mock('sentry/utils/useRoutes', () => ({
  useRoutes: jest.fn(() => []),
}));

describe('EventsTable', function () {
  beforeEach(() => {
    ProjectsStore.loadInitialData([
      {
        ...TestStubs.Project(),
        platform: 'javascript',
      },
    ]);
  });

  it('renders', function () {
    const {container} = render(
      <EventsTable
        tagList={[]}
        orgId="orgId"
        projectId="project-slug"
        groupId="groupId"
        orgFeatures={[]}
        events={TestStubs.DetailedEvents()}
        projects={[TestStubs.Project()]}
      />
    );
    expect(container).toSnapshot();
  });

  it('removes the replay column when the feature is disabled', () => {
    render(
      <EventsTable
        tagList={[
          {
            key: 'replayId',
            name: 'Replayid',
            totalValues: 5,
          },
        ]}
        orgId="orgId"
        projectId="project-slug"
        groupId="groupId"
        orgFeatures={[]}
        events={TestStubs.DetailedEvents()}
        projects={[TestStubs.Project()]}
      />
    );

    expect(screen.queryByRole('columnheader', {name: 'Replay'})).not.toBeInTheDocument();
  });

  it('does not show the replay column when the project does not support it', () => {
    ProjectsStore.loadInitialData([TestStubs.Project()]);

    render(
      <EventsTable
        tagList={[
          {
            key: 'replayId',
            name: 'Replayid',
            totalValues: 5,
          },
        ]}
        orgId="orgId"
        projectId="project-slug"
        groupId="groupId"
        orgFeatures={[]}
        events={TestStubs.DetailedEvents()}
        projects={[TestStubs.Project()]}
      />
    );

    expect(screen.queryByRole('columnheader', {name: 'Replay'})).not.toBeInTheDocument();
  });

  it('renders the replay column when the feature is enabled', () => {
    render(
      <EventsTable
        tagList={[
          {
            key: 'replayId',
            name: 'Replayid',
            totalValues: 5,
          },
        ]}
        orgId="orgId"
        projectId="project-slug"
        groupId="groupId"
        orgFeatures={['session-replay-ui']}
        events={TestStubs.DetailedEvents()}
        projects={[TestStubs.Project()]}
      />
    );

    expect(screen.getByRole('columnheader', {name: 'Replay'})).toBeVisible();
  });
});

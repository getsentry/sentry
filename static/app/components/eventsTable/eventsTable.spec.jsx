import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventsTable from 'sentry/components/eventsTable/eventsTable';

jest.mock('sentry/utils/useRoutes', () => ({
  useRoutes: jest.fn(() => []),
}));

describe('EventsTable', function () {
  it('renders', function () {
    const {container} = render(
      <EventsTable
        tagList={[]}
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        orgFeatures={[]}
        events={TestStubs.DetailedEvents()}
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
        projectId="projectId"
        groupId="groupId"
        orgFeatures={[]}
        events={TestStubs.DetailedEvents()}
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
        projectId="projectId"
        groupId="groupId"
        orgFeatures={['session-replay-ui']}
        events={TestStubs.DetailedEvents()}
      />
    );

    expect(screen.getByRole('columnheader', {name: 'Replay'})).toBeVisible();
  });
});

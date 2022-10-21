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
        orgFeatures={TestStubs.Organization().features}
        events={TestStubs.DetailedEvents()}
      />
    );
    expect(container).toSnapshot();
  });

  it('removes replayId from the tag list when the feature is disabled', () => {
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

    // eslint-disable-next-line jest-dom/prefer-in-document
    expect(screen.queryByText('Replay')).toBeNull();
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

    expect(screen.getByText('Replay')).toBeVisible();
  });
});

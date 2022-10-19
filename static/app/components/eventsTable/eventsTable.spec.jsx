import {render} from 'sentry-test/reactTestingLibrary';

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
});

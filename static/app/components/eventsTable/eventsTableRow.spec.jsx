import {render} from 'sentry-test/reactTestingLibrary';

import EventsTableRow from 'sentry/components/eventsTable/eventsTableRow';

jest.mock('sentry/utils/useRoutes', () => ({
  useRoutes: jest.fn(() => []),
}));

describe('EventsTableRow', function () {
  it('renders', function () {
    const {container} = render(
      <table>
        <tbody>
          <EventsTableRow
            organization={TestStubs.Organization()}
            tagList={[]}
            {...{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
            event={TestStubs.DetailedEvents()[0]}
          />
        </tbody>
      </table>
    );
    expect(container).toSnapshot();
  });
});

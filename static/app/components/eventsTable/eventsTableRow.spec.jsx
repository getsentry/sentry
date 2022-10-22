import {DetailedEvents} from 'fixtures/js-stubs/detailedEvents';
import {Organization} from 'fixtures/js-stubs/organization';

import {render} from 'sentry-test/reactTestingLibrary';

import EventsTableRow from 'sentry/components/eventsTable/eventsTableRow';

describe('EventsTableRow', function () {
  it('renders', function () {
    const {container} = render(
      <table>
        <tbody>
          <EventsTableRow
            organization={Organization()}
            tagList={[]}
            {...{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
            event={DetailedEvents()[0]}
          />
        </tbody>
      </table>
    );
    expect(container).toSnapshot();
  });
});

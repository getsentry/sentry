import {mountWithTheme} from 'sentry-test/enzyme';

import {EventsTableRow} from 'sentry/components/eventsTable/eventsTableRow';

describe('EventsTableRow', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(
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
    expect(wrapper).toSnapshot();
  });
});

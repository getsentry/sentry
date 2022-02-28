import {enzymeRender} from 'sentry-test/enzyme';

import EventsTable from 'sentry/components/eventsTable/eventsTable';

describe('EventsTable', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const wrapper = enzymeRender(
      <EventsTable
        tagList={[]}
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        events={TestStubs.DetailedEvents()}
      />
    );
    expect(wrapper).toSnapshot();
  });
});

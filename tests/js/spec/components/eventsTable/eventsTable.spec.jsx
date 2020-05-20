import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import EventsTable from 'app/components/eventsTable/eventsTable';

describe('EventsTable', function() {
  beforeEach(function() {});

  afterEach(function() {});

  it('renders', function() {
    const wrapper = shallow(
      <EventsTable
        tagList={[]}
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        events={TestStubs.DetailedEvents()}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});

import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import EventsTable from 'app/components/eventsTable/eventsTable';

describe('EventsTable', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const wrapper = mountWithTheme(
      <EventsTable
        tagList={[]}
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        events={TestStubs.DetailedEvents()}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toSnapshot();
  });
});

import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {EventsTableRow} from 'app/components/eventsTable/eventsTableRow';

describe('EventsTableRow', function() {
  it('renders', function() {
    const wrapper = shallow(
      <EventsTableRow
        organization={TestStubs.Organization()}
        tagList={[]}
        {...{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
        event={TestStubs.DetailedEvents()[0]}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});

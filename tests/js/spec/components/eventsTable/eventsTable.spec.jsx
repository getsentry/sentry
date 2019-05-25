import React from 'react';
import {shallow} from 'enzyme';
import EventsTable from 'app/components/eventsTable/eventsTable';

import events from '../../../mocks/events';

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
        events={events}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});

import React from 'react';
import {shallow} from 'enzyme';
import {EventsTableRow} from 'app/components/eventsTable/eventsTableRow';
import events from '../../../mocks/events';

describe('EventsTableRow', function() {
  it('renders', function() {
    let wrapper = shallow(
      <EventsTableRow
        organization={TestStubs.Organization()}
        tagList={[]}
        {...{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
        event={events[0]}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});

import React from 'react';
import {shallow} from 'enzyme';
import EventsTable from 'app/components/eventsTable/eventsTable';

import events from '../../../mocks/events';

describe('EventsTable', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(
      <EventsTable
        tagList={[]}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
        events={events}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});

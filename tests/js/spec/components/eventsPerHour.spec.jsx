import React from 'react';
import {shallow} from 'enzyme';
import EventsPerHour from 'app/components/events/eventsPerHour';

describe('EventsPerHour', function() {
  const data = {
    received: [[1461099600, 31734], [1461103200, 36790]],
    blacklisted: [[1461099600, 0], [1461103200, 0]],
    rejected: [[1461099600, 2867], [1461103200, 2742]],
  };

  it('should work', function() {
    sinon.stub(EventsPerHour.prototype, 'fetchData');
    let eventsPerHour = shallow(<EventsPerHour />).instance();
    expect(eventsPerHour.formatData(data)).toEqual([
      {
        data: [{x: 1461099600, y: 31734}, {x: 1461103200, y: 36790}],
        label: 'received',
      },
      {
        data: [{x: 1461099600, y: 2867}, {x: 1461103200, y: 2742}],
        label: 'rejected',
      },
      {
        data: [{x: 1461099600, y: 0}, {x: 1461103200, y: 0}],
        label: 'blacklisted',
      },
    ]);
  });
});

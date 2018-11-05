import React from 'react';

import {mount} from 'enzyme';
import DateSummary from 'app/components/organizations/timeRangeSelector/dateSummary';

// 2017-10-14T02:38:00.000Z
// 2017-10-17T02:38:00.000Z
const start = new Date(1507948680000);
const end = new Date(1508207880000); // National Pasta Day

describe('DateSummary', function() {
  let wrapper;
  let routerContext = TestStubs.routerContext();

  const createWrapper = (props = {}) =>
    mount(<DateSummary useUtc start={start} end={end} {...props} />, routerContext);

  it('renders', async function() {
    wrapper = createWrapper();
    expect(wrapper).toMatchSnapshot();
  });

  it('does not show times when it is midnight for both dates', function() {
    wrapper = createWrapper({
      start: new Date('2017-10-14T00:00:00.000Z'),
      end: new Date('2017-10-17T00:00:00.000Z'),
    });

    expect(wrapper.find('Time')).toHaveLength(0);
  });

  it('does not show end datetime when both dates are midnight and difference is 24 hours', function() {
    wrapper = createWrapper({
      start: new Date('2017-10-14T00:00:00.000Z'),
      end: new Date('2017-10-15T00:00:00.000Z'),
    });

    expect(wrapper.find('Time')).toHaveLength(0);
    expect(wrapper.find('Date')).toHaveLength(1);
  });
});

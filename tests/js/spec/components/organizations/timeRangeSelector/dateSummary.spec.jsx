import React from 'react';

import {mount} from 'enzyme';
import DateSummary from 'app/components/organizations/timeRangeSelector/dateSummary';

const start = new Date('2017-10-14T02:38:00.000Z');
const end = new Date('2017-10-17T02:38:00.000Z'); // National Pasta Day

describe('DateSummary', function() {
  let wrapper;
  let routerContext = TestStubs.routerContext();

  const createWrapper = (props = {}) =>
    mount(<DateSummary useUtc start={start} end={end} {...props} />, routerContext);

  it('renders', async function() {
    wrapper = createWrapper();
    expect(wrapper).toMatchSnapshot();
  });

  it('does not show times when it is midnight for start date and 23:59:59 for end date', function() {
    wrapper = createWrapper({
      start: new Date('2017-10-14T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
    });

    expect(wrapper.find('Time')).toHaveLength(0);
  });
});

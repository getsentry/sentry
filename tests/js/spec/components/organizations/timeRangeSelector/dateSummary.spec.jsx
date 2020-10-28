import React from 'react';

import {mount} from 'sentry-test/enzyme';

import DateSummary from 'app/components/organizations/timeRangeSelector/dateSummary';

const start = new Date('2017-10-14T02:38:00.000Z');
const end = new Date('2017-10-17T02:38:00.000Z'); // National Pasta Day

describe('DateSummary', function () {
  let wrapper;
  const routerContext = TestStubs.routerContext();

  const createWrapper = (props = {}) =>
    mount(<DateSummary utc start={start} end={end} {...props} />, routerContext);

  it('renders', async function () {
    wrapper = createWrapper();
    expect(wrapper).toSnapshot();
  });

  it('does not show times when it is midnight for start date and 23:59:59 for end date', function () {
    // Date Summary formats using system time
    // tests run on EST/EDT
    wrapper = createWrapper({
      start: new Date('2017-10-14T00:00:00.000-0400'),
      end: new Date('2017-10-17T23:59:59.000-0400'),
    });

    expect(wrapper.find('Time')).toHaveLength(0);
  });
});

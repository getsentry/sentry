import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import DateSummary from 'app/components/organizations/timeRangeSelector/dateSummary';

const start = new Date('2017-10-14T02:38:00.000Z');
const end = new Date('2017-10-17T02:38:00.000Z'); // National Pasta Day

describe('DateSummary', function () {
  const getComponent = (props = {}) => <DateSummary start={start} end={end} {...props} />;
  const createWrapper = (props = {}) => mountWithTheme(getComponent(props));

  it('renders', async function () {
    const {container} = createWrapper();
    expect(container).toSnapshot();
  });

  it('does not show times when it is midnight for start date and 23:59:59 for end date', function () {
    const {rerender} = createWrapper();
    // Search by year because date may change depending on timezone
    expect(screen.getAllByText(/Oct.+2017/)[0].childElementCount).toBe(1);

    // Date Summary formats using system time
    // tests run on EST/EDT
    rerender(
      getComponent({
        start: new Date('2017-10-14T00:00:00.000-0400'),
        end: new Date('2017-10-17T23:59:59.000-0400'),
      })
    );

    expect(screen.getAllByText(/Oct.+2017/)[0].childElementCount).toBe(0);
  });
});

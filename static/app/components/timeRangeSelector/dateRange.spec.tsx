import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {DateRange} from 'sentry/components/timeRangeSelector/dateRange';

jest.unmock('react-date-range');

describe('DateRange', () => {
  afterEach(() => {
    resetMockDate();
  });

  it("can select today's UTC date while the local date is still the day before", async () => {
    // 22:00 on Oct 16 in America/New_York, already Oct 17 in UTC
    setMockDate(new Date('2017-10-17T02:00:00Z'));
    const onChange = jest.fn();

    render(
      <DateRange
        utc
        start={new Date('2017-10-10T00:00:00')}
        end={new Date('2017-10-16T23:59:59')}
        onChange={onChange}
        onChangeUtc={jest.fn()}
      />
    );

    await userEvent.click(await screen.findByRole('button', {name: '17'}));

    expect(onChange).toHaveBeenCalledWith({
      start: new Date('2017-10-17T00:00:00'),
      end: new Date('2017-10-17T23:59:59'),
    });
  });
});

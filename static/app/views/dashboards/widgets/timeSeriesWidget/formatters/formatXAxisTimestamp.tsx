import moment from 'moment-timezone';

/**
 * A "cascading" formatter, based on the recommendations in [ECharts documentation](https://echarts.apache.org/en/option.html#xAxis.axisLabel.formatter). Given a timestamp of an X axis of type `"time"`, return a formatted string, to show under the axis tick.
 *
 * The fidelity of the formatted value depends on the fidelity of the tick mark timestamp. ECharts will intelligently choose the location of tick marks based on the total time range, and any significant intervals inside. It always chooses tick marks that fall on a "round" time values (starts of days, starts of hours, 15 minute intervals, etc.). This formatter is called on the time stamps of the selected ticks. Here are some examples of output labels sets you can expect:
 *
 * ["Feb 1st", "Feb 2nd", "Feb 3rd"] when ECharts aligns ticks with days of the month
 * ["11:00pm", "Feb 2nd", "1:00am"] when ECharts aligns ticks with hours across a day boundary
 * ["Mar 1st", "Apr 1st", "May 1st"] when ECharts aligns ticks with starts of month
 * ["Dec 1st", "Jan 1st 2025", "Feb 1st"] when ECharts aligns markers with starts of month across a year boundary
 * ["12:00pm", "1:00am", "2:00am", "3:00am"] when ECharts aligns ticks with hours starts
 *
 * @param value
 * @param options
 * @returns Formatted X axis label string
 */
export function formatXAxisTimestamp(
  value: number,
  options: {utc?: boolean} = {utc: false}
): string {
  const parsed = getParser(!options.utc)(value);

  // Granularity-aware parsing, adjusts the format based on the
  // granularity of the object This works well with ECharts since the
  // parser is not aware of the other ticks
  let format = 'MMM Do';

  if (
    parsed.dayOfYear() === 1 &&
    parsed.hour() === 0 &&
    parsed.minute() === 0 &&
    parsed.second() === 0
  ) {
    // Start of a year
    format = 'MMM Do YYYY';
  } else if (
    parsed.day() === 0 &&
    parsed.hour() === 0 &&
    parsed.minute() === 0 &&
    parsed.second() === 0
  ) {
    // Start of a month
    format = 'MMM Do';
  } else if (parsed.hour() === 0 && parsed.minute() === 0 && parsed.second() === 0) {
    // Start of a day
    format = 'MMM Do';
  } else if (parsed.second() === 0) {
    // Hours, minutes
    format = 'LT';
  } else {
    // Hours, minutes, seconds
    format = 'LTS';
  }

  return parsed.format(format);
}

function getParser(local = false): typeof moment | typeof moment.utc {
  return local ? moment : moment.utc;
}

import moment from 'moment';
import momentTimezone from 'moment-timezone';

import ConfigStore from 'sentry/stores/configStore';

interface Props extends React.HTMLAttributes<HTMLTimeElement> {
  date: moment.MomentInput | momentTimezone.MomentInput;
  dateOnly?: boolean;
  format?: string;
  seconds?: boolean;
  shortDate?: boolean;
  timeAndDate?: boolean;
  timeOnly?: boolean;
  utc?: boolean;
}

function DateTime({
  format,
  date,
  utc,
  shortDate,
  dateOnly,
  timeOnly,
  timeAndDate,
  seconds = true,
  ...props
}: Props) {
  function getFormat({clock24Hours}: {clock24Hours: boolean}): string {
    if (format) {
      return format;
    }

    // October 26, 2017
    if (dateOnly) {
      return 'LL';
    }

    // Oct 26, 11:30 AM
    if (timeAndDate) {
      if (clock24Hours) {
        return 'MMM DD, HH:mm';
      }

      return 'MMM DD, LT';
    }

    // 4:57 PM
    if (timeOnly) {
      if (clock24Hours) {
        return 'HH:mm';
      }

      return 'LT';
    }

    if (shortDate) {
      return 'MM/DD/YYYY';
    }

    if (clock24Hours) {
      if (seconds) {
        // Oct 26, 2017 11:30:30
        return 'MMM D, YYYY HH:mm:ss';
      }

      // Oct 26, 2017 11:30
      return 'MMM D, YYYY HH:mm';
    }

    // Oct 26, 2017 11:30:30 AM
    if (seconds) {
      return 'll LTS z';
    }

    // Default is Oct 26, 2017 11:30 AM
    return 'lll';
  }

  const user = ConfigStore.get('user');
  const options = user?.options;
  const formatString = getFormat(options);

  return (
    <time {...props}>
      {utc
        ? moment.utc(date as moment.MomentInput).format(formatString)
        : momentTimezone.tz(date, options?.timezone ?? '').format(formatString)}
    </time>
  );
}

export default DateTime;

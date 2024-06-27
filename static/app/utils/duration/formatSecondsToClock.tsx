import round from 'lodash/round';

import {HOUR, MINUTE, SECOND} from 'sentry/utils/formatters';

export function formatSecondsToClock(
  seconds: number,
  {padAll}: {padAll: boolean} = {padAll: true}
) {
  if (seconds === 0 || isNaN(seconds)) {
    return padAll ? '00:00' : '0:00';
  }

  const divideBy = (msValue: number, time: number) => {
    return {
      quotient: msValue < 0 ? Math.ceil(msValue / time) : Math.floor(msValue / time),
      remainder: msValue % time,
    };
  };

  // value in milliseconds
  const absMSValue = round(Math.abs(seconds * 1000));

  const {quotient: hours, remainder: rMins} = divideBy(absMSValue, HOUR);
  const {quotient: minutes, remainder: rSeconds} = divideBy(rMins, MINUTE);
  const {quotient: secs, remainder: milliseconds} = divideBy(rSeconds, SECOND);

  const fill = (num: number) => (num < 10 ? `0${num}` : String(num));

  const parts = hours
    ? [padAll ? fill(hours) : hours, fill(minutes), fill(secs)]
    : [padAll ? fill(minutes) : minutes, fill(secs)];

  const ms = `000${milliseconds}`.slice(-3);
  return milliseconds ? `${parts.join(':')}.${ms}` : parts.join(':');
}

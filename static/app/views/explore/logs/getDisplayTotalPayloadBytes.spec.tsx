import {LOGS_LARGE_SEARCH_TOTAL_THRESHOLD_BYTES} from 'sentry/views/explore/logs/constants';

import {getDisplayTotalPayloadBytes} from './getDisplayTotalPayloadBytes';

const ONE_TIB = LOGS_LARGE_SEARCH_TOTAL_THRESHOLD_BYTES; // 1 TiB exactly

describe('LogsBytesScanned', () => {
  it('returns undefined when totalPayloadBytes is undefined', () => {
    const actual = getDisplayTotalPayloadBytes(1024, undefined);
    expect(actual).toBeUndefined();
  });

  it('returns undefined when bytesScanned equals totalPayloadBytes', () => {
    const actual = getDisplayTotalPayloadBytes(ONE_TIB, ONE_TIB);
    expect(actual).toBeUndefined();
  });

  it('returns undefined when bytesScanned is less than totalPayloadBytes and totalPayloadBytes does not meet the 1 TiB threshold', () => {
    const actual = getDisplayTotalPayloadBytes(ONE_TIB / 2, ONE_TIB - 1);
    expect(actual).toBeUndefined();
  });

  it('returns totalPayloadBytes when bytesScanned is less than totalPayloadBytes and totalPayloadBytes meets the 1 TiB threshold', () => {
    const actual = getDisplayTotalPayloadBytes(ONE_TIB / 2, ONE_TIB);
    expect(actual).toBe(ONE_TIB);
  });

  it('returns totalPayloadBytes when bytesScanned is less than totalPayloadBytes and totalPayloadBytes exceeds the 1 TiB threshold', () => {
    const actual = getDisplayTotalPayloadBytes(ONE_TIB / 2, ONE_TIB + 1);
    expect(actual).toBe(ONE_TIB + 1);
  });
});

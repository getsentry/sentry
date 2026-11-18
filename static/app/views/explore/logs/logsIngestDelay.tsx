import {MAX_LOG_INGEST_DELAY} from './constants';
import {OurLogKnownFieldKey} from './types';

export function getMaxIngestDelayTimestamp() {
  return BigInt(Date.now() - MAX_LOG_INGEST_DELAY) * 1_000_000n;
}

export function getIngestDelayFilterValue(timestamp: bigint) {
  return `<=${timestamp}`;
}

export function getIngestDelayFilter() {
  return ` ${OurLogKnownFieldKey.TIMESTAMP_PRECISE}:${getIngestDelayFilterValue(getMaxIngestDelayTimestamp())}`;
}

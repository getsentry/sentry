import {LOGS_LARGE_SEARCH_TOTAL_THRESHOLD_BYTES} from './constants';

export function getDisplayTotalPayloadBytes(
  bytesScanned: number | undefined,
  totalPayloadBytes: number | undefined
) {
  return totalPayloadBytes &&
    totalPayloadBytes >= LOGS_LARGE_SEARCH_TOTAL_THRESHOLD_BYTES &&
    bytesScanned &&
    bytesScanned < totalPayloadBytes
    ? totalPayloadBytes
    : undefined;
}

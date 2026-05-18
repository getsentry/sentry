import {Fragment} from 'react';

import {FileSize} from 'sentry/components/fileSize';
import {t} from 'sentry/locale';
import {LOGS_LARGE_SEARCH_TOTAL_THRESHOLD_BYTES} from 'sentry/views/explore/logs/constants';

function getDisplayTotalPayloadBytes(
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

interface LogsBytesScannedProps {
  bytesScanned: number;
  totalPayloadBytes?: number;
}

export function LogsBytesScanned({
  bytesScanned,
  totalPayloadBytes,
}: LogsBytesScannedProps) {
  const displayTotalPayloadBytes = getDisplayTotalPayloadBytes(
    bytesScanned,
    totalPayloadBytes
  );

  if (!displayTotalPayloadBytes) {
    return <FileSize bytes={bytesScanned} base={2} />;
  }

  return (
    <Fragment>
      <FileSize bytes={bytesScanned} base={2} /> {t('of')} ~
      <FileSize bytes={displayTotalPayloadBytes} base={2} />
    </Fragment>
  );
}

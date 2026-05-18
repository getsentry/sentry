import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LOGS_LARGE_SEARCH_TOTAL_THRESHOLD_BYTES} from 'sentry/views/explore/logs/constants';
import {LogsBytesScanned} from 'sentry/views/explore/logs/logsPayloadBytesDisplay';

const ONE_TIB = LOGS_LARGE_SEARCH_TOTAL_THRESHOLD_BYTES; // 1 TiB exactly

describe('LogsBytesScanned', () => {
  it('renders just the scanned size when totalPayloadBytes is below the threshold', () => {
    render(<LogsBytesScanned bytesScanned={512} totalPayloadBytes={ONE_TIB - 1} />);
    expect(screen.getByText('512.0 B')).toBeInTheDocument();
    expect(screen.queryByText('of ~')).not.toBeInTheDocument();
  });

  it('renders just the scanned size when totalPayloadBytes is undefined', () => {
    render(<LogsBytesScanned bytesScanned={1024} />);
    expect(screen.getByText('1.0 KiB')).toBeInTheDocument();
    expect(screen.queryByText('of ~')).not.toBeInTheDocument();
  });

  it('renders scanned size with total when totalPayloadBytes meets the threshold', () => {
    render(<LogsBytesScanned bytesScanned={ONE_TIB / 2} totalPayloadBytes={ONE_TIB} />);

    expect(screen.getByText('512.0 GiB')).toBeInTheDocument();
    expect(screen.getByText('of ~')).toBeInTheDocument();
    expect(screen.getByText('1.0 TiB')).toBeInTheDocument();
  });

  it('renders just the scanned size when bytesScanned equals totalPayloadBytes', () => {
    render(<LogsBytesScanned bytesScanned={ONE_TIB} totalPayloadBytes={ONE_TIB} />);
    expect(screen.queryByText('of ~')).not.toBeInTheDocument();
  });
});

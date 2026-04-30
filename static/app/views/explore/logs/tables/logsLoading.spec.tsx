import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LogsLoading} from 'sentry/views/explore/logs/tables/logsLoading';

function TableBodyWrapper({children}: {children?: React.ReactNode}) {
  return (
    <table>
      <tbody>{children}</tbody>
    </table>
  );
}

describe('LogsLoading', () => {
  it('shows a single scanned size when haystack denominator is hidden', () => {
    render(<LogsLoading bytesScanned={8_000_000} estimatedTotalBytes={undefined} />, {
      additionalWrapper: TableBodyWrapper,
    });

    expect(screen.getByText(/needle in a haystack/i)).toBeInTheDocument();
    expect(screen.getByText(/MiB/)).toBeInTheDocument();
    expect(screen.getByText(/scanned/)).toBeInTheDocument();
    expect(screen.queryByText(' of ')).not.toBeInTheDocument();
  });

  it('shows X of Y scanned when haystack denominator is enabled', () => {
    const twoTib = 2 * 1024 ** 4;
    render(<LogsLoading bytesScanned={500_000_000} estimatedTotalBytes={twoTib} />, {
      additionalWrapper: TableBodyWrapper,
    });

    expect(screen.getByText(/needle in a haystack/i)).toBeInTheDocument();
    const row = screen.getByRole('row');
    expect(row).toHaveTextContent('476.8 MiB');
    expect(row).toHaveTextContent('2.0 TiB');
    expect(row).toHaveTextContent(' of ');
    expect(row).toHaveTextContent('scanned');
  });
});

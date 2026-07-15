import {downloadLogs} from 'sentry/views/explore/logs/exports/downloadLogs';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';

const mockDownloadLogsAsCsv = jest.fn();

jest.mock('sentry/views/explore/logs/exports/downloadLogsAsCsv', () => ({
  get downloadLogsAsCsv() {
    return mockDownloadLogsAsCsv;
  },
}));

const mockDownloadAsJsonl = jest.fn();

jest.mock('sentry/components/exports/downloadAsJsonl', () => ({
  get downloadAsJsonl() {
    return mockDownloadAsJsonl;
  },
}));

const fields = [OurLogKnownFieldKey.MESSAGE];
const filename = 'logs-export';

const row = (message: string) =>
  ({[OurLogKnownFieldKey.MESSAGE]: message}) as OurLogsResponseItem;

describe('downloadLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to downloadLogsAsCsv when format is csv', () => {
    const rows = [row('a'), row('b'), row('c')];
    const expected = 'csv-result';

    mockDownloadLogsAsCsv.mockReturnValue(expected);

    const result = downloadLogs({
      format: 'csv',
      rows,
      fields,
      filename,
    });

    expect(mockDownloadLogsAsCsv).toHaveBeenCalledTimes(1);
    expect(mockDownloadLogsAsCsv).toHaveBeenCalledWith(rows, fields, filename);
    expect(mockDownloadAsJsonl).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });

  it('delegates to downloadAsJsonl when format is json', () => {
    const rows = [row('a'), row('b'), row('c')];
    const expected = 'json-result';

    mockDownloadAsJsonl.mockReturnValue(expected);

    const result = downloadLogs({
      format: 'jsonl',
      rows,
      fields,
      filename,
    });

    expect(mockDownloadAsJsonl).toHaveBeenCalledTimes(1);
    expect(mockDownloadAsJsonl).toHaveBeenCalledWith(rows, filename);
    expect(mockDownloadLogsAsCsv).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });
});

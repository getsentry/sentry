import {downloadLogs} from 'sentry/views/explore/logs/exports/downloadLogs';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';

const mockDownloadLogsAsCsv = jest.fn();

jest.mock('sentry/views/explore/logs/exports/downloadLogsAsCsv', () => ({
  get downloadLogsAsCsv() {
    return mockDownloadLogsAsCsv;
  },
}));

const mockDownloadLogsAsJsonl = jest.fn();

jest.mock('sentry/views/explore/logs/exports/downloadLogsAsJsonl', () => ({
  get downloadLogsAsJsonl() {
    return mockDownloadLogsAsJsonl;
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
    expect(mockDownloadLogsAsJsonl).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });

  it('delegates to downloadLogsAsJsonl when format is json', () => {
    const rows = [row('a'), row('b'), row('c')];
    const expected = 'json-result';

    mockDownloadLogsAsJsonl.mockReturnValue(expected);

    const result = downloadLogs({
      format: 'jsonl',
      rows,
      fields,
      filename,
    });

    expect(mockDownloadLogsAsJsonl).toHaveBeenCalledTimes(1);
    expect(mockDownloadLogsAsJsonl).toHaveBeenCalledWith(rows, filename);
    expect(mockDownloadLogsAsCsv).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });
});

import {downloadRows} from 'sentry/components/exports/downloadRows';

const mockDownloadRowsAsCsv = jest.fn();

jest.mock('sentry/components/exports/downloadRowsAsCsv', () => ({
  get downloadRowsAsCsv() {
    return mockDownloadRowsAsCsv;
  },
}));

const mockDownloadAsJsonl = jest.fn();

jest.mock('sentry/components/exports/downloadAsJsonl', () => ({
  get downloadAsJsonl() {
    return mockDownloadAsJsonl;
  },
}));

const fields = ['message'];
const filename = 'logs-export';

const row = (message: string) => ({message});

describe('downloadRows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to downloadRowsAsCsv when format is csv', () => {
    const rows = [row('a'), row('b'), row('c')];
    const expected = 'csv-result';

    mockDownloadRowsAsCsv.mockReturnValue(expected);

    const result = downloadRows({
      format: 'csv',
      rows,
      fields,
      filename,
    });

    expect(mockDownloadRowsAsCsv).toHaveBeenCalledTimes(1);
    expect(mockDownloadRowsAsCsv).toHaveBeenCalledWith(rows, fields, filename);
    expect(mockDownloadAsJsonl).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });

  it('delegates to downloadAsJsonl when format is json', () => {
    const rows = [row('a'), row('b'), row('c')];
    const expected = 'json-result';

    mockDownloadAsJsonl.mockReturnValue(expected);

    const result = downloadRows({
      format: 'jsonl',
      rows,
      fields,
      filename,
    });

    expect(mockDownloadAsJsonl).toHaveBeenCalledTimes(1);
    expect(mockDownloadAsJsonl).toHaveBeenCalledWith(rows, filename);
    expect(mockDownloadRowsAsCsv).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });
});

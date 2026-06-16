import {generateLogExportRowCountOptions} from 'sentry/views/explore/logs/exports/generateLogExportRowCountOptions';

describe('generateLogExportRowCountOptions', () => {
  it('adds an abbreviated (All) option when estimate is between predefined thresholds', () => {
    expect(generateLogExportRowCountOptions(1_500)).toEqual({
      rowCountDefault: {label: '500', value: 500},
      rowCountOptions: [
        {label: '100', value: 100},
        {label: '500', value: 500},
        {label: '1,000', value: 1_000},
        {label: '1.5K (All)', value: 1_500},
      ],
    });
  });

  it('adds an abbreviated (All) option when estimate is below the first predefined threshold', () => {
    expect(generateLogExportRowCountOptions(50)).toEqual({
      rowCountDefault: {label: '50 (All)', value: 50},
      rowCountOptions: [{label: '50 (All)', value: 50}],
    });
  });

  it('does not add an (All) option when estimate equals a predefined threshold', () => {
    expect(generateLogExportRowCountOptions(10_000)).toEqual({
      rowCountDefault: {label: '500', value: 500},
      rowCountOptions: [
        {label: '100', value: 100},
        {label: '500', value: 500},
        {label: '1,000', value: 1_000},
        {label: '10,000', value: 10_000},
      ],
    });
  });
});

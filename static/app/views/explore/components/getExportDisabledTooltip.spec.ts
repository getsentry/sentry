import {getExportDisabledTooltip} from 'sentry/views/explore/components/getExportDisabledTooltip';

describe('getExportDisabledTooltip', () => {
  it('returns undefined when data is ready and non-empty', () => {
    expect(
      getExportDisabledTooltip({
        isDataEmpty: false,
        isDataError: false,
        isDataLoading: false,
      })
    ).toBeUndefined();
  });

  it('returns undefined when no options are provided', () => {
    expect(getExportDisabledTooltip({})).toBeUndefined();
  });

  it('returns a loading message when isDataLoading is true', () => {
    expect(getExportDisabledTooltip({isDataLoading: true})).toBe('Loading...');
  });

  it('returns error message when isDataError is true and not loading', () => {
    expect(getExportDisabledTooltip({isDataError: true})).toBe(
      'Unable to export due to an error'
    );
  });

  it('returns empty message when isDataEmpty is true and not loading or error', () => {
    expect(getExportDisabledTooltip({isDataEmpty: true})).toBe('No data to export');
  });

  it('returns a loading message when all three options are provided', () => {
    expect(
      getExportDisabledTooltip({
        isDataEmpty: true,
        isDataError: true,
        isDataLoading: true,
      })
    ).toBe('Loading...');
  });

  it('returns an error message when the empty and error options are provided', () => {
    expect(
      getExportDisabledTooltip({
        isDataEmpty: true,
        isDataError: true,
      })
    ).toBe('Unable to export due to an error');
  });
});

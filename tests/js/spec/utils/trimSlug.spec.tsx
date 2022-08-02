import {trimSlug} from 'sentry/utils/trimSlug';

describe('trimSlug', function () {
  it('returns slug if it is already short enough', function () {
    expect(trimSlug('javascript', 20)).toBe('javascript');
  });

  it('trims long but unhyphenated slug', function () {
    expect(trimSlug('javascriptfrontendproject', 20)).toBe('javascriptfrontendp…');
  });

  it('trims slug from the middle, preserves whole words', function () {
    expect(trimSlug('symbol-collector-console', 20)).toBe('symbol…console');
    expect(trimSlug('symbol-collector-mobile', 20)).toBe('symbol…mobile');
    expect(trimSlug('visual-snapshot-cloud-run', 20)).toBe('visual…cloud-run');
  });

  it('trims slug from the middle, cuts whole words', function () {
    expect(trimSlug('sourcemapsio-javascript', 20)).toBe('sourcemaps…javascript');
    expect(trimSlug('armcknight-ios-ephemeraldemo', 20)).toBe('armcknig…phemeraldemo');
  });
});

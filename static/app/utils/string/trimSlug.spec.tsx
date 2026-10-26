import {trimSlug} from 'sentry/utils/string/trimSlug';

describe('trimSlug', () => {
  it('returns slug if it is already short enough', () => {
    expect(trimSlug('javascript')).toBe('javascript');
  });

  it('trims long but unhyphenated slug', () => {
    expect(trimSlug('javascriptfrontendproject')).toBe('javascriptfrontendp…');
  });

  it('trims slug from the middle, preserves whole words', () => {
    expect(trimSlug('symbol-collector-console')).toBe('symbol…console');
    expect(trimSlug('symbol-collector-mobile')).toBe('symbol…mobile');
    expect(trimSlug('visual-snapshot-cloud-run')).toBe('visual…cloud-run');
  });

  it('trims slug from the middle, cuts whole words', () => {
    expect(trimSlug('sourcemapsio-javascript')).toBe('sourcemaps…javascript');
    expect(trimSlug('armcknight-ios-ephemeraldemo')).toBe('armcknig…phemeraldemo');
  });
});

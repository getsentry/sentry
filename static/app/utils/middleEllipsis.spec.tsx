import {middleEllipsis} from 'sentry/utils/middleEllipsis';

describe('middleEllipsis', function () {
  it('returns slug if it is already short enough', function () {
    expect(middleEllipsis('javascript', 20, ' ')).toBe('javascript');
  });

  it('trims long but unhyphenated slug', function () {
    expect(middleEllipsis('javascriptfrontendproject', 20, ' ')).toBe(
      'javascriptfrontendp…'
    );
  });

  it('trims slug from the middle, preserves whole words', function () {
    expect(middleEllipsis('symbol collector console', 20, ' ')).toBe('symbol…console');
    expect(middleEllipsis('symbol collector mobile', 20, ' ')).toBe('symbol…mobile');
    expect(middleEllipsis('visual snapshot cloud run', 20, ' ')).toBe('visual…cloud run');
    expect(middleEllipsis('visual snapshot.cloud-run', 20, / |\./)).toBe(
      'visual…cloud-run'
    );
    expect(
      middleEllipsis(
        'visual collector.console-running on_cloud.technology-task.with_luck',
        50,
        / |\.|-|_|\s/
      )
    ).toBe('visual collector.console…technology-task.with_luck');
  });

  it('trims slug from the middle, cuts whole words', function () {
    expect(middleEllipsis('sourcemapsio javascript', 20, ' ')).toBe(
      'sourcemaps…javascript'
    );
    expect(middleEllipsis('armcknight ios.ephemeraldemo', 20, /\.| /)).toBe(
      'armcknig…phemeraldemo'
    );
  });
});

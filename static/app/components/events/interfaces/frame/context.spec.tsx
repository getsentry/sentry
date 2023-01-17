import {Coverage, LineCoverage} from 'sentry/types';

import {getCoverageColors} from './context';

describe('Frame - Context', function () {
  const org = TestStubs.Organization();
  const lines: Array<[number, string]> = [
    [231, 'this is line 231'],
    [232, 'this is line 232'],
    [233, 'this is line 233'],
    [234, 'this is line 234'],
  ];

  const lineCoverage: LineCoverage[] = [
    {lineNo: 230, coverage: Coverage.PARTIAL},
    {lineNo: 231, coverage: Coverage.PARTIAL},
    {lineNo: 232, coverage: Coverage.COVERED},
    {lineNo: 234, coverage: Coverage.NOT_COVERED},
  ];

  it("doesn't show colors if the feature is disabled", function () {
    expect(getCoverageColors(org, true, lines, lineCoverage)).toEqual([
      'transparent',
      'transparent',
      'transparent',
      'transparent',
    ]);
  });

  it("doesn't show colors without data", function () {
    expect(getCoverageColors(org, false, lines, lineCoverage)).toEqual([
      'transparent',
      'transparent',
      'transparent',
      'transparent',
    ]);
  });

  it('converts coverage data to the right colors', function () {
    const organization = {
      ...org,
      features: ['codecov-stacktrace-integration'],
      codecovAccess: true,
    };
    expect(getCoverageColors(organization, true, lines, lineCoverage)).toEqual([
      'yellow100',
      'green100',
      'transparent',
      'red100',
    ]);
  });
});

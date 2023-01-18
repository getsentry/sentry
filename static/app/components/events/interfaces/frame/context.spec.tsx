import {Coverage, LineCoverage} from 'sentry/types';

import {getCoverageColors} from './context';

describe('Frame - Context', function () {
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

  it('converts coverage data to the right colors', function () {
    expect(getCoverageColors(lines, lineCoverage)).toEqual([
      'yellow100',
      'green100',
      'transparent',
      'red100',
    ]);
  });
});

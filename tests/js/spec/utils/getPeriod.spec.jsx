import {getPeriod} from 'app/utils/getPeriod';

describe('getPeriod()', function () {
  const start = new Date('2017-10-03T02:41:20.000Z');
  const end = new Date('2017-10-17T14:31:42.000Z');

  it('prioritizes period over start/end', function () {
    const periodObj = {period: '7d', start, end};
    expect(getPeriod(periodObj)).toEqual({
      statsPeriod: '7d',
    });
  });

  it('doubles relative period', function () {
    const periodObj = {period: '7d'};
    expect(getPeriod(periodObj, {shouldDoublePeriod: true})).toEqual({
      statsPeriod: '14d',
    });
  });

  it('returns start and end dates', function () {
    const periodObj = {start, end};
    expect(getPeriod(periodObj)).toEqual({
      start: '2017-10-03T02:41:20',
      end: '2017-10-17T14:31:42',
    });
  });

  it('doubles period when given start and end dates', function () {
    const periodObj = {start, end};
    expect(getPeriod(periodObj, {shouldDoublePeriod: true})).toEqual({
      start: '2017-09-18T14:50:58',
      end: '2017-10-17T14:31:42',
    });
  });
});

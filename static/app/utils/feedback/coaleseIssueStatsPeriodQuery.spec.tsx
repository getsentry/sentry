import coaleseIssueStatsPeriodQuery from 'sentry/utils/feedback/coaleseIssueStatsPeriodQuery';

const Jan1st = new Date('2024-01-01');
const Oct31 = new Date('2024-10-31');

describe('coaleseIssueStatsPeriodQuery', () => {
  it('should convert a statsPeriod into start+end fields', () => {
    const result = coaleseIssueStatsPeriodQuery({
      listHeadTime: Oct31.getTime(),
      queryView: {statsPeriod: '14d'},
    });
    expect(result).toEqual({
      start: '2024-10-17T00:00:00.000Z', // Oct 18, 14 days earlier
      end: '2024-10-31T00:00:00.000Z', // Oct 31
    });
  });

  it('should default to 0d when statsPeriod is missing', () => {
    const result = coaleseIssueStatsPeriodQuery({
      listHeadTime: Oct31.getTime(),
      queryView: {statsPeriod: ''},
    });
    expect(result).toEqual({});
  });

  it('should ignore statsPeriod and start+end fields that have 1 day between them when prefetch is true', () => {
    const result = coaleseIssueStatsPeriodQuery({
      listHeadTime: Jan1st.getTime(),
      queryView: {statsPeriod: '14d'},
      prefetch: true,
    });
    expect(result).toEqual({
      limit: 1,
      start: '2024-01-01T00:00:00.000Z', // Jan 1st
      end: '2024-01-02T00:00:00.000Z', // Jan 2nd, one day laters
    });
  });

  it('should undefined when there is no statsPeriod and prefetch is true', () => {
    const result = coaleseIssueStatsPeriodQuery({
      listHeadTime: Jan1st.getTime(),
      queryView: {statsPeriod: ''},
      prefetch: true,
    });
    expect(result).toBeUndefined();
  });
});

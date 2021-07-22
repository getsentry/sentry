import {Operation, parseArithmetic} from 'app/components/arithmeticInput/parser';

describe('arithmeticInput/parser', function () {
  it('handles some addition', () => {
    expect(parseArithmetic('1 + 2')).toStrictEqual(
      new Operation({
        operator: 'plus',
        lhs: '1',
        rhs: '2',
      })
    );
  });

  it('handles three term addition', () => {
    expect(parseArithmetic('1 + 2 + 3')).toStrictEqual(
      new Operation({
        operator: 'plus',
        lhs: new Operation({
          operator: 'plus',
          lhs: '1',
          rhs: '2',
        }),
        rhs: '3',
      })
    );
  });

  it('handles some multiplication', () => {
    expect(parseArithmetic('1 * 2')).toStrictEqual(
      new Operation({
        operator: 'multiply',
        lhs: '1',
        rhs: '2',
      })
    );
  });

  it('handles three term multiplication', () => {
    expect(parseArithmetic('1 * 2 * 3')).toStrictEqual(
      new Operation({
        operator: 'multiply',
        lhs: new Operation({
          operator: 'multiply',
          lhs: '1',
          rhs: '2',
        }),
        rhs: '3',
      })
    );
  });

  it('handles brackets', () => {
    expect(parseArithmetic('1 * (2 + 3)')).toStrictEqual(
      new Operation({
        operator: 'multiply',
        lhs: '1',
        rhs: new Operation({
          operator: 'plus',
          lhs: '2',
          rhs: '3',
        }),
      })
    );

    expect(parseArithmetic('(1 + 2) / 3')).toStrictEqual(
      new Operation({
        operator: 'divide',
        lhs: new Operation({
          operator: 'plus',
          lhs: '1',
          rhs: '2',
        }),
        rhs: '3',
      })
    );
  });

  it('handles order of operations', () => {
    expect(parseArithmetic('1 + 2 * 3')).toStrictEqual(
      new Operation({
        operator: 'plus',
        lhs: '1',
        rhs: new Operation({
          operator: 'multiply',
          lhs: '2',
          rhs: '3',
        }),
      })
    );

    expect(parseArithmetic('1 / 2 - 3')).toStrictEqual(
      new Operation({
        operator: 'minus',
        lhs: new Operation({
          operator: 'divide',
          lhs: '1',
          rhs: '2',
        }),
        rhs: '3',
      })
    );
  });

  it('handles fields and functions', () => {
    expect(parseArithmetic('spans.db + measurements.lcp')).toStrictEqual(
      new Operation({
        operator: 'plus',
        lhs: 'spans.db',
        rhs: 'measurements.lcp',
      })
    );

    expect(parseArithmetic('failure_count() + count_unique(user)')).toStrictEqual(
      new Operation({
        operator: 'plus',
        lhs: 'failure_count()',
        rhs: 'count_unique(user)',
      })
    );
  });
});

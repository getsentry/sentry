import {Operation, parseArithmetic} from 'sentry/components/arithmeticInput/parser';

function operation(
  operator: Operation['operator'],
  lhs: Operation['lhs'],
  rhs: Operation['rhs']
) {
  const result = new Operation({operator, rhs: rhs!});
  result.lhs = lhs;
  return result;
}

describe('arithmeticInput/parser', () => {
  it('errors on too many operators', () => {
    expect(parseArithmetic('1+1+1+1+1+1+1+1+1+1+1+1').error).toBe(
      'Maximum operators exceeded'
    );
  });

  it('errors on divide by 0', () => {
    expect(parseArithmetic('1/0').error).toBe('Division by 0 is not allowed');
  });

  it('handles one term', () => {
    expect(parseArithmetic('1').result).toBe('1');
  });

  it('handles some addition', () => {
    expect(parseArithmetic('1 + 2').result).toStrictEqual(operation('plus', '1', '2'));
  });

  it('handles three term addition', () => {
    expect(parseArithmetic('1 + 2 + 3').result).toStrictEqual(
      operation('plus', operation('plus', '1', '2'), '3')
    );
  });

  it('handles some multiplication', () => {
    expect(parseArithmetic('1 * 2').result).toStrictEqual(operation('multiply', '1', '2'));
  });

  it('handles three term multiplication', () => {
    expect(parseArithmetic('1 * 2 * 3').result).toStrictEqual(
      operation('multiply', operation('multiply', '1', '2'), '3')
    );
  });

  it('handles brackets', () => {
    expect(parseArithmetic('1 * (2 + 3)').result).toStrictEqual(
      operation('multiply', '1', operation('plus', '2', '3'))
    );

    expect(parseArithmetic('(1 + 2) / 3').result).toStrictEqual(
      operation('divide', operation('plus', '1', '2'), '3')
    );
  });

  it('handles order of operations', () => {
    expect(parseArithmetic('1 + 2 * 3').result).toStrictEqual(
      operation('plus', '1', operation('multiply', '2', '3'))
    );

    expect(parseArithmetic('1 / 2 - 3').result).toStrictEqual(
      operation('minus', operation('divide', '1', '2'), '3')
    );
  });

  it('handles fields and functions', () => {
    expect(parseArithmetic('spans.db + measurements.lcp').result).toStrictEqual(
      operation('plus', 'spans.db', 'measurements.lcp')
    );

    expect(parseArithmetic('failure_count() + count_unique(user)').result).toStrictEqual(
      operation('plus', 'failure_count()', 'count_unique(user)')
    );
  });
});

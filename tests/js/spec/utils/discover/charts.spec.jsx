import {tooltipFormatter, axisLabelFormatter} from 'app/utils/discover/charts';

describe('tooltipFormatter()', function() {
  it('formats values', function() {
    const cases = [
      // function, input, expected
      ['count()', 0.1, '0.1'],
      ['avg(thing)', 0.125126, '0.125'],
      ['failure_rate()', 0.66123, '66.12%'],
      ['p50()', 100, '100.00ms'],
      ['p50()', 100.23, '100.23ms'],
      ['p50()', 1200, '1.20s'],
      ['p50()', 86400000, '24.00hr'],
    ];
    for (const scenario of cases) {
      expect(tooltipFormatter(scenario[1], scenario[0])).toEqual(scenario[2]);
    }
  });
});

describe('axisLabelFormatter()', function() {
  it('formats values', function() {
    const cases = [
      // type, input, expected
      ['count()', 0.1, '0.1'],
      ['avg(thing)', 0.125126, '0.125'],
      ['failure_rate()', 0.66123, '66%'],
      ['p50()', 100, '100ms'],
      ['p50()', 1200, '1s'],
      ['p50()', 86400000, '24hr'],
    ];
    for (const scenario of cases) {
      expect(axisLabelFormatter(scenario[1], scenario[0])).toEqual(scenario[2]);
    }
  });
});

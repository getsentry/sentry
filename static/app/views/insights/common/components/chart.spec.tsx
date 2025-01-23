import {render, screen} from 'sentry-test/reactTestingLibrary';

import BaseChart from 'sentry/components/charts/baseChart';
import MarkLine from 'sentry/components/charts/components/markLine';
import type {Series} from 'sentry/types/echarts';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';

jest.mock('sentry/components/charts/baseChart', () => {
  return jest.fn().mockImplementation(() => <div />);
});
jest.mock('react', () => {
  return {
    ...jest.requireActual('react'),
    useRef: jest.fn(),
  };
});
// XXX: Mocking useRef throws an error for AnimatePrecense, so it must be mocked as well
jest.mock('framer-motion', () => {
  return {
    ...jest.requireActual('framer-motion'),
    AnimatePresence: jest.fn().mockImplementation(({children}) => <div>{children}</div>),
  };
});

describe('Chart', function () {
  test('it shows an error panel if an error prop is supplied', function () {
    const parsingError = new Error('Could not parse chart data');

    render(
      <Chart error={parsingError} data={[]} loading={false} type={ChartType.LINE} />,
      // Mocked useRef breaks router
      {disableRouterMocks: true}
    );

    expect(screen.getByTestId('chart-error-panel')).toBeInTheDocument();
  });

  it('does not propagate mark line to the incomplete series', function () {
    const start = Date.now();
    const mockedSeries: Series[] = [
      {
        seriesName: 'series',
        data: [
          {name: start - 120_000, value: 5},
          {name: start - 90_000, value: 4},
          {name: start - 60_000, value: 3},
          {name: start - 30_000, value: 2},
          {name: start, value: 1},
        ],
        markLine: MarkLine({
          data: [
            {
              type: 'average',
              yAxis: 3,
            },
          ],
        }),
      },
    ];
    render(<Chart data={mockedSeries} loading={false} type={ChartType.LINE} />, {
      // Mocked useRef breaks router
      disableRouterMocks: true,
    });
    expect(jest.mocked(BaseChart).mock.calls[0]![0].series?.[0]).toHaveProperty(
      'markLine'
    );
    expect(jest.mocked(BaseChart).mock.calls[0]![0].series?.[1]).not.toHaveProperty(
      'markLine'
    );
  });
});

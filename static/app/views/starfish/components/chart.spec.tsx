import {render, screen} from 'sentry-test/reactTestingLibrary';

import Chart, {ChartType} from 'sentry/views/starfish/components/chart';

describe('Chart', function () {
  test('it shows an error panel if an error prop is supplied', function () {
    const parsingError = new Error('Could not parse chart data');

    render(
      <Chart error={parsingError} data={[]} loading={false} type={ChartType.LINE} />
    );

    expect(screen.getByTestId('chart-error-panel')).toBeInTheDocument();
  });
});

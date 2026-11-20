import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ChartBandTooltip, ChartBandTooltipHeading} from './chartBandTooltip';

const bucket = {start: Date.UTC(2024, 0, 12, 15, 0), end: Date.UTC(2024, 0, 12, 15, 5)};

describe('ChartBandTooltip', () => {
  it('shows the bucket range', () => {
    render(
      <ChartBandTooltip
        bucket={bucket}
        sections={[<ChartBandTooltipHeading key="drops" label="Drops" value="25%" />]}
        timezone="UTC"
      />
    );

    expect(screen.getByText('Jan 12, 2024 3:00 PM - 3:05 PM UTC')).toBeInTheDocument();
  });

  it('shows each section in order with a separator between them', () => {
    render(
      <ChartBandTooltip
        bucket={bucket}
        sections={[
          <ChartBandTooltipHeading key="drops" label="Drops" value="25%" />,
          <ChartBandTooltipHeading key="releases" label="Releases" value={3} />,
        ]}
        timezone="UTC"
      />
    );

    expect(screen.getByText('Drops')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('Releases')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });
});

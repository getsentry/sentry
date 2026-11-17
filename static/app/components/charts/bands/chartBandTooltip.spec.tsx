import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ChartBandTooltip, ChartBandTooltipHeading} from './chartBandTooltip';

const bucket = {
  start: Date.UTC(2024, 0, 12, 15, 0),
  end: Date.UTC(2024, 0, 12, 15, 5),
};

describe('ChartBandTooltip', () => {
  it('shows the bucket range in the header', () => {
    render(
      <ChartBandTooltip
        bucket={bucket}
        sections={[<ChartBandTooltipHeading key="drops" label="Drops" value="25%" />]}
        timezone="UTC"
      />
    );

    expect(screen.getByRole('banner')).toHaveTextContent(
      'Jan 12, 2024 3:00 PM - 3:05 PM UTC'
    );
  });

  it('shows the full end date for a bucket that spans days', () => {
    render(
      <ChartBandTooltip
        bucket={{start: bucket.start, end: Date.UTC(2024, 0, 13, 15, 0)}}
        sections={[]}
        timezone="UTC"
      />
    );

    expect(
      screen.getByText('Jan 12, 2024 3:00 PM - Jan 13, 2024 3:00 PM UTC')
    ).toBeInTheDocument();
  });

  it('shows each section in order, separated from the header and each other', () => {
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
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });
});

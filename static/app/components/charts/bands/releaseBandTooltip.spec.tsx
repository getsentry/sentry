import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ReleaseBandTooltipSection} from './releaseBandTooltip';

function bucketWith(versions: string[]) {
  return {
    start: 0,
    end: 60_000,
    releases: versions.map(version => ({version, timestamp: '2024-01-12T15:00:00Z'})),
  };
}

describe('ReleaseBandTooltipSection', () => {
  it('shows the release count and each formatted version', () => {
    render(<ReleaseBandTooltipSection bucket={bucketWith(['ui@1.0.0', 'ui@1.1.0'])} />);

    expect(screen.getByText('Releases')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('1.1.0')).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('lists the first three versions and counts the rest', () => {
    render(
      <ReleaseBandTooltipSection
        bucket={bucketWith(['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0'])}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
    expect(screen.queryByText('1.3.0')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});

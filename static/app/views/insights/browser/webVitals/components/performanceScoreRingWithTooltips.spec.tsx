import {render, screen} from 'sentry-test/reactTestingLibrary';

import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';

describe('PerformanceScoreRingWithTooltips', function () {
  const projectScore = {
    lcpScore: 74,
    fcpScore: 92,
    clsScore: 71,
    ttfbScore: 99,
    inpScore: 98,
    totalScore: 83,
    lcpWeight: 38,
    fcpWeight: 23,
    clsWeight: 18,
    ttfbWeight: 16,
    inpWeight: 5,
  };

  it('renders inp', async () => {
    render(
      <PerformanceScoreRingWithTooltips
        weights={{lcp: 38, fcp: 23, cls: 18, ttfb: 16, inp: 10}}
        width={220}
        height={200}
        projectScore={projectScore}
        ringBackgroundColors={['#444674', '#895289', '#d6567f', '#f38150', '#f2b712']}
        ringSegmentColors={['#444674', '#895289', '#d6567f', '#f38150', '#f2b712']}
        text={undefined}
      />
    );
    await screen.findByText('inp');
    screen.getByText('fcp');
    screen.getByText('cls');
    screen.getByText('ttfb');
    screen.getByText('lcp');
  });
});

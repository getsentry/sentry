import {render, screen} from 'sentry-test/reactTestingLibrary';

import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';

describe('PerformanceScoreRingWithTooltips', function () {
  it('renders segment labels', async () => {
    const projectScore = {
      lcpScore: 74,
      fcpScore: 92,
      clsScore: 71,
      ttfbScore: 99,
      inpScore: 98,
      totalScore: 83,
    };
    render(
      <PerformanceScoreRingWithTooltips
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

  it('renders empty state with default weights', async () => {
    const projectScore = {
      lcpScore: 10,
      fcpScore: 10,
      clsScore: 10,
      ttfbScore: 10,
      inpScore: 10,
      totalScore: 10,
    };
    render(
      <PerformanceScoreRingWithTooltips
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

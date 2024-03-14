import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import PerformanceScoreRingWithTooltips from 'sentry/views/performance/browser/webVitals/components/performanceScoreRingWithTooltips';

jest.mock('sentry/utils/useOrganization');
describe('PerformanceScoreRingWithTooltips', function () {
  const organization = OrganizationFixture();
  const projectScore = {
    lcpScore: 74,
    fcpScore: 92,
    clsScore: 71,
    ttfbScore: 99,
    fidScore: 98,
    inpScore: 98,
    totalScore: 83,
    lcpWeight: 38,
    fcpWeight: 23,
    clsWeight: 18,
    ttfbWeight: 16,
    fidWeight: 5,
    inpWeight: 5,
  };

  beforeEach(function () {
    jest.mocked(useOrganization).mockReturnValue(organization);
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it('renders segment labels', async () => {
    render(
      <PerformanceScoreRingWithTooltips
        weights={{lcp: 38, fcp: 23, cls: 18, ttfb: 16, fid: 10, inp: 0}}
        width={220}
        height={200}
        projectScore={projectScore}
        ringBackgroundColors={['#444674', '#895289', '#d6567f', '#f38150', '#f2b712']}
        ringSegmentColors={['#444674', '#895289', '#d6567f', '#f38150', '#f2b712']}
        text={undefined}
      />
    );
    await screen.findByText('lcp');
    screen.getByText('fcp');
    screen.getByText('cls');
    screen.getByText('ttfb');
    screen.getByText('fid');
  });

  it('renders inp', async () => {
    const organizationWithInp = OrganizationFixture({
      features: ['starfish-browser-webvitals-replace-fid-with-inp'],
    });
    jest.mocked(useOrganization).mockReturnValue(organizationWithInp);
    render(
      <PerformanceScoreRingWithTooltips
        weights={{lcp: 38, fcp: 23, cls: 18, ttfb: 16, fid: 0, inp: 10}}
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

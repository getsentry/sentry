import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import WebVitalMeters from 'sentry/views/performance/browser/webVitals/components/webVitalMeters';
import type {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('WebVitalMeters', function () {
  const organization = OrganizationFixture();
  const projectScore: ProjectScore = {
    lcpWeight: 30,
    fcpWeight: 20,
    fidWeight: 25,
    clsWeight: 15,
    ttfbWeight: 10,
    inpWeight: 10,
  };
  const projectData: TableData = {
    data: [],
  };

  beforeEach(function () {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });
    jest.mocked(useOrganization).mockReturnValue(organization);
  });

  it('renders web vital meters with first input delay', async () => {
    render(<WebVitalMeters projectData={projectData} projectScore={projectScore} />);
    await screen.findByText('Largest Contentful Paint');
    screen.getByText('First Contentful Paint');
    screen.getByText('Cumulative Layout Shift');
    screen.getByText('Time To First Byte');
    screen.getByText('First Input Delay');
  });

  it('renders web vital meters with interaction to next paint', async () => {
    const organizationWithInp = OrganizationFixture({
      features: ['starfish-browser-webvitals-replace-fid-with-inp'],
    });
    jest.mocked(useOrganization).mockReturnValue(organizationWithInp);
    render(<WebVitalMeters projectData={projectData} projectScore={projectScore} />);
    await screen.findByText('Largest Contentful Paint');
    screen.getByText('First Contentful Paint');
    screen.getByText('Cumulative Layout Shift');
    screen.getByText('Time To First Byte');
    screen.getByText('Interaction to Next Paint');
  });
});

import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {UptimeDetectorDetails} from './index';

describe('UptimeDetectorDetails', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/3/checks/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/1/`,
      body: UserFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/uptime-summary/',
      body: {},
    });
  });

  it('renders the detector details sections', async () => {
    const detector = UptimeDetectorFixture({id: '3'});

    render(<UptimeDetectorDetails detector={detector} project={project} />, {
      organization,
    });

    expect(await screen.findByText('Detect')).toBeInTheDocument();
    expect(screen.getByText('Resolve')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
  });

  it('renders the checked URL in detect section', async () => {
    const detector = UptimeDetectorFixture({
      id: '3',
      dataSources: [
        {
          ...UptimeDetectorFixture().dataSources[0],
          queryObj: {
            ...UptimeDetectorFixture().dataSources[0].queryObj,
            method: 'POST',
            url: 'https://example.com/api',
          },
        },
      ],
    });

    render(<UptimeDetectorDetails detector={detector} project={project} />, {
      organization,
    });

    expect(await screen.findByText('POST https://example.com/api')).toBeInTheDocument();
  });

  it('displays recent check-ins section', async () => {
    const detector = UptimeDetectorFixture({id: '3'});

    render(<UptimeDetectorDetails detector={detector} project={project} />, {
      organization,
    });

    expect(await screen.findByText('Recent Check-Ins')).toBeInTheDocument();
  });
});

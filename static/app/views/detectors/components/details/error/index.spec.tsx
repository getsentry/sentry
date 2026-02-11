import {ErrorDetectorFixture} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ErrorDetectorDetails} from 'sentry/views/detectors/components/details/error';

describe('ErrorDetectorDetails', () => {
  const defaultProps = {
    detector: ErrorDetectorFixture(),
    project: ProjectFixture(),
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: ProjectFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&project=1&query=is%3Aunresolved%20detector%3A2&statsPeriod=14d',
      method: 'GET',
      body: [GroupFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      method: 'GET',
      body: UserFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/`,
      body: GroupFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/detectors/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/workflows/`,
      body: [],
    });
  });

  describe('Resolve section', () => {
    it('displays the auto-resolve time when it is configured', async () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: ProjectFixture({
          resolveAge: 30 * 24,
        }),
      });

      render(<ErrorDetectorDetails {...defaultProps} />);

      expect(
        await screen.findByText('Auto-resolve after 30 days of inactivity.')
      ).toBeInTheDocument();
    });

    it('displays correct text when auto-resolve is disabled', async () => {
      const project = ProjectFixture({resolveAge: 0});

      render(<ErrorDetectorDetails {...defaultProps} project={project} />);

      expect(await screen.findByText('Auto-resolution disabled.')).toBeInTheDocument();
    });
  });
});

import {ErrorDetectorFixture} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {DetailedProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ErrorDetectorDetails} from 'sentry/views/detectors/components/details/error';

describe('ErrorDetectorDetails', () => {
  const defaultProps = {
    detector: ErrorDetectorFixture(),
    project: DetailedProjectFixture(),
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: DetailedProjectFixture(),
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
      url: '/organizations/org-slug/issues/1/',
      body: GroupFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [],
    });
  });

  describe('breadcrumbs', () => {
    it('renders the parent crumbs in the trail and the project as the page title', async () => {
      render(<ErrorDetectorDetails {...defaultProps} />);

      const monitorsCrumb = await screen.findByRole('link', {name: 'Monitors'});
      expect(monitorsCrumb).toHaveAttribute('href', '/organizations/org-slug/monitors/');
      expect(screen.getByRole('link', {name: 'Error'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/monitors/errors/'
      );

      expect(
        screen.getByRole('heading', {name: defaultProps.project.slug, level: 1})
      ).toBeInTheDocument();

      const trail = monitorsCrumb.closest('ol')!;
      expect(
        within(trail).queryByText(defaultProps.project.slug)
      ).not.toBeInTheDocument();
    });
  });

  describe('Resolve section', () => {
    it('displays the auto-resolve time when it is configured', async () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: DetailedProjectFixture({
          resolveAge: 30 * 24,
        }),
      });

      render(<ErrorDetectorDetails {...defaultProps} />);

      expect(
        await screen.findByText('Auto-resolve after 30 days of inactivity.')
      ).toBeInTheDocument();
    });

    it('displays correct text when auto-resolve is disabled', async () => {
      const project = DetailedProjectFixture({resolveAge: 0});

      render(<ErrorDetectorDetails {...defaultProps} project={project} />);

      expect(await screen.findByText('Auto-resolution disabled.')).toBeInTheDocument();
    });
  });
});

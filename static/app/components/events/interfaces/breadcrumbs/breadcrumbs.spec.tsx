import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Breadcrumbs} from 'sentry/components/events/interfaces/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import useProjects from 'sentry/utils/useProjects';

jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useLoadReplayReader');
jest.mock('sentry/utils/useProjects');

describe('Breadcrumbs', () => {
  let props: React.ComponentProps<typeof Breadcrumbs>;

  beforeEach(() => {
    const project = ProjectFixture({platform: 'javascript'});

    jest.mocked(useProjects).mockReturnValue({
      fetchError: null,
      fetching: false,
      hasMore: false,
      initiallyLoaded: false,
      onSearch: () => Promise.resolve(),
      reloadProjects: jest.fn(),
      placeholders: [],
      projects: [project],
    });

    props = {
      organization: OrganizationFixture(),
      event: EventFixture({entries: [], projectID: project.id}),
      data: {
        values: [
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'hey',
            category: 'error',
            level: BreadcrumbLevelType.INFO,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'hello',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'bye',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'ok',
            category: 'error',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.INFO,
            type: BreadcrumbType.INFO,
          },
        ],
      },
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            title: '/settings/',
            'project.name': 'javascript',
            id: 'abcdabcdabcdabcdabcdabcdabcdabcd',
          },
        ],
        meta: {},
      },
    });
  });

  describe('filterCrumbs', function () {
    it('should filter crumbs based on crumb message', async function () {
      render(<Breadcrumbs {...props} />);

      await userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'hi');

      expect(
        await screen.findByText('Sorry, no breadcrumbs match your search query')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Clear'));

      await userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'up');

      expect(
        screen.queryByText('Sorry, no breadcrumbs match your search query')
      ).not.toBeInTheDocument();

      expect(screen.getAllByText(textWithMarkupMatcher('sup'))).toHaveLength(3);
    });

    it('should filter crumbs based on crumb level', async function () {
      render(<Breadcrumbs {...props} />);

      await userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'war');

      // breadcrumbs + filter item
      // TODO(Priscila): Filter should not render in the dom if not open
      expect(screen.getAllByText(textWithMarkupMatcher('Warning'))).toHaveLength(5);
    });

    it('should filter crumbs based on crumb category', async function () {
      render(<Breadcrumbs {...props} />);

      await userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'error');

      expect(screen.getAllByText(textWithMarkupMatcher('error'))).toHaveLength(2);
    });
  });

  describe('render', function () {
    it('should display the correct number of crumbs with no filter', async function () {
      props.data.values = props.data.values.slice(0, 4);

      render(<Breadcrumbs {...props} />);

      // data.values + virtual crumb
      expect(await screen.findAllByTestId('crumb')).toHaveLength(4);

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should display the correct number of crumbs with a filter', async function () {
      props.data.values = props.data.values.slice(0, 4);

      render(<Breadcrumbs {...props} />);

      const searchInput = screen.getByPlaceholderText('Search breadcrumbs');

      await userEvent.type(searchInput, 'sup');

      expect(screen.queryByTestId('crumb')).not.toBeInTheDocument();

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should not crash if data contains a toString attribute', async function () {
      // Regression test: A "toString" property in data should not falsely be
      // used to coerce breadcrumb data to string. This would cause a TypeError.
      const data = {nested: {toString: 'hello'}};

      props.data.values = [
        {
          message: 'sup',
          category: 'default',
          level: BreadcrumbLevelType.INFO,
          type: BreadcrumbType.INFO,
          data,
        },
      ];

      render(<Breadcrumbs {...props} />);

      // data.values + virtual crumb
      expect(await screen.findByTestId('crumb')).toBeInTheDocument();

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should render Sentry Transactions crumb', async function () {
      props.organization.features = ['performance-view'];
      props.data.values = [
        {
          message: '12345678123456781234567812345678',
          category: 'sentry.transaction',
          level: BreadcrumbLevelType.INFO,
          type: BreadcrumbType.TRANSACTION,
        },
        {
          message: 'abcdabcdabcdabcdabcdabcdabcdabcd',
          category: 'sentry.transaction',
          level: BreadcrumbLevelType.INFO,
          type: BreadcrumbType.TRANSACTION,
        },
      ];

      render(<Breadcrumbs {...props} />);

      // Transaction not in response should show as non-clickable id
      expect(
        await screen.findByText('12345678123456781234567812345678')
      ).toBeInTheDocument();

      expect(screen.getByText('12345678123456781234567812345678')).not.toHaveAttribute(
        'href'
      );

      // Transaction in response should show as clickable title
      expect(await screen.findByRole('link', {name: '/settings/'})).toBeInTheDocument();

      expect(screen.getByText('/settings/')).toHaveAttribute(
        'href',
        '/organizations/org-slug/performance/project-slug:abcdabcdabcdabcdabcdabcdabcdabcd/?referrer=breadcrumbs'
      );
    });
  });
});

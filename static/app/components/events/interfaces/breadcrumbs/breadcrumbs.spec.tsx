import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import Breadcrumbs from 'sentry/components/events/interfaces/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import ReplayReader from 'sentry/utils/replays/replayReader';

const mockReplay = ReplayReader.factory(TestStubs.ReplayReaderParams());

jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

jest.mock('sentry/utils/replays/hooks/useReplayData', () => {
  return {
    __esModule: true,
    default: jest.fn(() => {
      return {
        replay: mockReplay,
        fetching: false,
      };
    }),
  };
});

describe('Breadcrumbs', () => {
  let props: React.ComponentProps<typeof Breadcrumbs>;
  const {router} = initializeOrg();

  beforeEach(() => {
    props = {
      route: {},
      router,
      organization: TestStubs.Organization(),
      projectSlug: 'project-slug',
      isShare: false,
      event: TestStubs.Event({entries: []}),
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
  });

  describe('filterCrumbs', function () {
    it('should filter crumbs based on crumb message', async function () {
      render(<Breadcrumbs {...props} />);

      userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'hi');

      expect(
        await screen.findByText('Sorry, no breadcrumbs match your search query')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText('Clear'));

      userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'up');

      expect(
        screen.queryByText('Sorry, no breadcrumbs match your search query')
      ).not.toBeInTheDocument();

      expect(screen.getAllByText(textWithMarkupMatcher('sup'))).toHaveLength(3);
    });

    it('should filter crumbs based on crumb level', function () {
      render(<Breadcrumbs {...props} />);

      userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'war');

      // breadcrumbs + filter item
      // TODO(Priscila): Filter should not render in the dom if not open
      expect(screen.getAllByText(textWithMarkupMatcher('Warning'))).toHaveLength(5);
    });

    it('should filter crumbs based on crumb category', function () {
      render(<Breadcrumbs {...props} />);

      userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'error');

      expect(screen.getAllByText(textWithMarkupMatcher('error'))).toHaveLength(2);
    });
  });

  describe('render', function () {
    it('should display the correct number of crumbs with no filter', function () {
      props.data.values = props.data.values.slice(0, 4);

      render(<Breadcrumbs {...props} />);

      // data.values + virtual crumb
      expect(screen.getAllByTestId('crumb')).toHaveLength(4);

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should display the correct number of crumbs with a filter', function () {
      props.data.values = props.data.values.slice(0, 4);

      render(<Breadcrumbs {...props} />);

      const searchInput = screen.getByPlaceholderText('Search breadcrumbs');

      userEvent.type(searchInput, 'sup');

      expect(screen.queryByTestId('crumb')).not.toBeInTheDocument();

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should not crash if data contains a toString attribute', function () {
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
      expect(screen.getByTestId('crumb')).toBeInTheDocument();

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should render a replay when there is a replayId', async function () {
      render(
        <Breadcrumbs
          {...props}
          event={TestStubs.Event({
            entries: [],
            tags: [{key: 'replayId', value: '761104e184c64d439ee1014b72b4d83b'}],
          })}
          organization={TestStubs.Organization({
            features: ['session-replay-ui'],
          })}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Replays')).toBeVisible();
        expect(screen.getByTestId('player-container')).toBeInTheDocument();
      });
    });
  });
});

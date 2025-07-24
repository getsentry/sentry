import {destroyAnnouncer} from '@react-aria/live-announcer';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {SeerComboBox} from 'sentry/views/explore/components/seerComboBox/seerComboBox';

const defaultProps = {
  filterKeys: {},
  getTagValues: () => Promise.resolve([]),
  initialQuery: 'test',
  searchSource: 'test',
};

describe('SeerComboBox', () => {
  beforeEach(() => {
    // Combobox announcements will pollute the test output if we don't clear them
    destroyAnnouncer();

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-explorer-ai/setup/',
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-explorer-ai/query/',
      method: 'POST',
      body: {
        status: 'ok',
        queries: [
          {
            query: 'span.duration:>30s',
            stats_period: '',
            group_by: [],
            visualization: [{chart_type: 1, y_axes: ['count()']}],
            sort: '-span.duration',
          },
        ],
      },
    });
  });

  it('renders the search input', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <SeerComboBox initialQuery="test" />
      </SearchQueryBuilderProvider>
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('test');
  });

  it('sets the passed initial query as the input value', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <SeerComboBox initialQuery="test" />
      </SearchQueryBuilderProvider>
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    expect(input).toHaveValue('test');
  });

  it('defaults popover to be open', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <SeerComboBox initialQuery="test" />
      </SearchQueryBuilderProvider>
    );

    const header = await screen.findByRole('heading', {
      name: /Describe what you're looking for!/,
    });
    expect(header).toBeInTheDocument();
  });

  it('closes seer search when close button is clicked', async () => {
    function TestComponent() {
      const {displaySeerResults, setDisplaySeerResults} = useSearchQueryBuilder();
      return displaySeerResults ? (
        <SeerComboBox initialQuery="test" />
      ) : (
        <div>
          <p>Not Seer Search</p>
          <button onClick={() => setDisplaySeerResults(true)}>Open Seer Search</button>
        </div>
      );
    }

    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <TestComponent />
      </SearchQueryBuilderProvider>
    );

    const openSeerSearchButton = await screen.findByText('Open Seer Search');
    await userEvent.click(openSeerSearchButton);

    const closeButton = await screen.findByRole('button', {
      name: 'Close Seer Search',
    });
    await userEvent.click(closeButton);

    const notSeerSearch = await screen.findByText('Not Seer Search');
    expect(notSeerSearch).toBeInTheDocument();
  });

  it('displays results after user searches', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <SeerComboBox initialQuery="" />
      </SearchQueryBuilderProvider>
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'test{Enter}');

    const filter = await screen.findByText('Filter');
    expect(filter).toBeInTheDocument();
  });

  it('applies the query to the route query params when selected via keyboard', async () => {
    const {router} = render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <SeerComboBox initialQuery="" />
      </SearchQueryBuilderProvider>,
      {
        initialRouterConfig: {location: {pathname: '/foo/'}},
      }
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'test{Enter}');

    await userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() =>
      expect(router.location.query).toEqual({
        mode: 'samples',
        query: 'span.duration:>30s',
        sort: '-span.duration',
        statsPeriod: '14d',
        visualize: '{"chartType":1,"yAxes":["count()"]}',
      })
    );
  });
});

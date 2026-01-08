import type {ReactNode} from 'react';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FieldKind} from 'sentry/utils/fields';
import * as spanTagsModule from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {
  useQueryParamsFields,
  useQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {SpansTabContent} from 'sentry/views/explore/spans/spansTab';
import {TraceItemDataset} from 'sentry/views/explore/types';

function Wrapper({children}: {children: ReactNode}) {
  return (
    <SpansQueryParamsProvider>
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        {children}
      </TraceItemAttributeProvider>
    </SpansQueryParamsProvider>
  );
}

jest.mock('sentry/utils/analytics');

const mockStringTags: TagCollection = {
  stringTag1: {key: 'stringTag1', kind: FieldKind.TAG, name: 'stringTag1'},
  stringTag2: {key: 'stringTag2', kind: FieldKind.TAG, name: 'stringTag2'},
};

const mockNumberTags: TagCollection = {
  numberTag1: {key: 'numberTag1', kind: FieldKind.MEASUREMENT, name: 'numberTag1'},
  numberTag2: {key: 'numberTag2', kind: FieldKind.MEASUREMENT, name: 'numberTag2'},
};

const datePageFilterProps: DatePageFilterProps = {
  defaultPeriod: '7d' as const,
  maxPickableDays: 7,
  relativeOptions: ({arbitraryOptions}) => ({
    ...arbitraryOptions,
    '1h': 'Last hour',
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
  }),
};

describe('SpansTabContent', () => {
  const {organization, project} = initializeOrg({
    organization: {
      features: [
        'gen-ai-features',
        'gen-ai-explore-traces',
        'gen-ai-explore-traces-consent-ui',
        'traces-page-cross-event-querying',
      ],
    },
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [project].map(p => parseInt(p.id, 10)),
      environments: [],
      datetime: {period: '7d', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
      match: [MockApiClient.matchQuery({attributeType: 'number'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {
          key: 'project',
          name: 'project',
          attributeSource: {source_type: 'sentry'},
        },
      ],
      match: [MockApiClient.matchQuery({attributeType: 'string'})],
    });
  });

  it('should fire analytics once per change', async () => {
    render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
      organization,
      additionalWrapper: Wrapper,
    });

    await screen.findByText(/No spans found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({result_mode: 'span samples'})
    );

    (trackAnalytics as jest.Mock).mockClear();
    await userEvent.click(await screen.findByText('Trace Samples'));

    await screen.findByText(/No trace results found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({result_mode: 'trace samples'})
    );

    (trackAnalytics as jest.Mock).mockClear();
    await userEvent.click(await screen.findByRole('tab', {name: 'Aggregates'}));

    await screen.findByText(/No spans found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({result_mode: 'aggregates'})
    );
  });

  it('inserts group bys from aggregate mode as fields in samples mode', async () => {
    let fields: readonly string[] = [];
    let groupBys: readonly string[] = [];
    function Component() {
      fields = useQueryParamsFields();
      groupBys = useQueryParamsGroupBys();
      return <SpansTabContent datePageFilterProps={datePageFilterProps} />;
    }

    render(<Component />, {organization, additionalWrapper: Wrapper});

    const samples = screen.getByRole('tab', {name: 'Span Samples'});
    const aggregates = screen.getByRole('tab', {name: 'Aggregates'});
    const groupBy = screen.getByTestId('section-group-by');

    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
    ]); // default
    expect(groupBys).toEqual(['']);

    // Add a group by, and leave one unselected
    await userEvent.click(aggregates);

    const editorColumn = screen.getAllByTestId('editor-column')[0]!;

    await userEvent.click(within(editorColumn).getByRole('button', {name: '\u2014'}));
    await userEvent.click(within(groupBy).getByRole('option', {name: 'project'}));

    expect(groupBys).toEqual(['project']);
    await userEvent.click(within(groupBy).getByRole('button', {name: 'Add Group'}));
    expect(groupBys).toEqual(['project', '']);

    await userEvent.click(samples);
    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
      'project',
    ]);
  }, 20_000);

  it('opens toolbar when switching to aggregates tab', async () => {
    render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
      organization,
      additionalWrapper: Wrapper,
    });

    // by default the toolbar should be visible
    expect(screen.getByTestId('explore-span-toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Expand sidebar')).not.toBeInTheDocument();

    // collapse the toolbar
    await userEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(screen.queryByTestId('explore-span-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Collapse sidebar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();

    // switching to the aggregates tab should expand the toolbar
    await userEvent.click(await screen.findByRole('tab', {name: 'Aggregates'}));
    expect(screen.getByTestId('explore-span-toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Expand sidebar')).not.toBeInTheDocument();

    // collapse the toolbar
    await userEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(screen.queryByTestId('explore-span-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Collapse sidebar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();

    // switching to the span samples tab should NOT expand the toolbar
    await userEvent.click(await screen.findByRole('tab', {name: 'Span Samples'}));
    expect(screen.queryByTestId('explore-span-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Collapse sidebar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
  });

  describe('case sensitivity', () => {
    it('renders the case sensitivity toggle', () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
      });

      const caseSensitivityToggle = screen.getByRole('button', {
        name: 'Ignore case',
      });
      expect(caseSensitivityToggle).toBeInTheDocument();
    });

    it('toggles case sensitivity', async () => {
      const {router} = render(
        <SpansTabContent datePageFilterProps={datePageFilterProps} />,
        {organization, additionalWrapper: Wrapper}
      );

      const caseSensitivityToggle = screen.getByRole('button', {
        name: 'Ignore case',
      });
      expect(caseSensitivityToggle).toBeInTheDocument();
      await userEvent.click(caseSensitivityToggle);

      expect(caseSensitivityToggle).toHaveAttribute('aria-pressed', 'true');
      expect(router.location.query.caseInsensitive).toBe('1');
    });

    it('appends case sensitive to the query', async () => {
      const eventsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        method: 'GET',
        body: {},
      });
      const eventsTimeSeriesMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        body: {
          timeSeries: [],
        },
      });

      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
      });

      const caseSensitivityToggle = screen.getByRole('button', {
        name: 'Ignore case',
      });
      expect(caseSensitivityToggle).toBeInTheDocument();
      await userEvent.click(caseSensitivityToggle);

      await waitFor(() =>
        expect(eventsMock).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/events/`,
          expect.objectContaining({
            query: expect.objectContaining({caseInsensitive: '1'}),
          })
        )
      );

      await waitFor(() =>
        expect(eventsTimeSeriesMock).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/events-timeseries/`,
          expect.objectContaining({
            query: expect.objectContaining({caseInsensitive: 1}),
          })
        )
      );
    });
  });

  describe('schema hints', () => {
    let spies: jest.SpyInstance[];

    beforeEach(() => {
      const useSpanTagsSpy = jest
        .spyOn(spanTagsModule, 'useTraceItemTags')
        .mockImplementation(type => {
          switch (type) {
            case 'number':
              return {tags: mockNumberTags, isLoading: false, secondaryAliases: {}};
            case 'string':
              return {tags: mockStringTags, isLoading: false, secondaryAliases: {}};
            default:
              return {tags: {}, isLoading: false, secondaryAliases: {}};
          }
        });

      // Mock getBoundingClientRect for container
      const getBoundingClientRectSpy = jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          // Mock individual hint items
          if (this.hasAttribute('data-type')) {
            return {
              width: 200,
              right: 200,
              left: 0,
              top: 0,
              bottom: 100,
              height: 100,
              x: 0,
              y: 0,
              toJSON: () => {},
            };
          }
          return {
            width: 1000,
            right: 1000,
            left: 0,
            top: 0,
            bottom: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => {},
          };
        });

      // Mock clientWidth before rendering to display hints
      const clientWidthGetSpy = jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(1000);

      spies = [useSpanTagsSpy, getBoundingClientRectSpy, clientWidthGetSpy];
    });

    afterEach(() => {
      spies.forEach(spy => spy.mockRestore());
    });

    it('should show hints', () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
      });

      expect(screen.getByText('stringTag1')).toBeInTheDocument();
      expect(screen.getByText('stringTag2')).toBeInTheDocument();
      expect(screen.getByText('numberTag1')).toBeInTheDocument();
      expect(screen.getByText('numberTag2')).toBeInTheDocument();
      expect(screen.getByText('See full list')).toBeInTheDocument();
    });
  });

  describe('Ask Seer', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/seer/setup-check/',
        body: AutofixSetupFixture({
          setupAcknowledgement: {
            orgHasAcknowledged: true,
            userHasAcknowledged: true,
          },
        }),
      });
    });

    describe('when the AI features are disabled', () => {
      it('does not display the Ask Seer combobox', async () => {
        render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
          organization: {...organization, features: []},
          additionalWrapper: Wrapper,
        });

        const input = screen.getByRole('combobox');
        await userEvent.click(input);

        expect(screen.queryByText(/Ask AI to build your query/)).not.toBeInTheDocument();
      });
    });

    it('brings along the query', async () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
      });

      const input = screen.getByRole('combobox');
      await userEvent.click(input);
      await userEvent.type(input, 'span.duration:>10ms{enter}');

      // re-open the combobox
      await userEvent.click(input);
      const askSeer = await screen.findByText(/Ask AI to build your query/);
      await userEvent.click(askSeer);

      const askSeerInput = screen.getByRole('combobox', {
        name: 'Ask Seer with Natural Language',
      });

      await waitFor(() => {
        expect(askSeerInput).toHaveValue('span.duration is greater than 10ms ');
      });
    });

    it('brings along the user input', async () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
      });

      const input = screen.getByRole('combobox');
      await userEvent.click(input);
      await userEvent.type(input, ' random');

      const askSeer = await screen.findByText(/Ask AI to build your query/);
      await userEvent.click(askSeer);

      const askSeerInput = screen.getByRole('combobox', {
        name: 'Ask Seer with Natural Language',
      });

      await waitFor(() => {
        expect(askSeerInput).toHaveValue('random ');
      });
    });

    it('brings along only the query and the user input', async () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
      });

      const input = screen.getByRole('combobox');
      await userEvent.click(input);
      await userEvent.type(input, 'span.duration:>10ms{enter}');
      await userEvent.type(input, ' random');

      const askSeer = await screen.findByText(/Ask AI to build your query/);
      await userEvent.click(askSeer);

      const askSeerInput = screen.getByRole('combobox', {
        name: 'Ask Seer with Natural Language',
      });

      await waitFor(() => {
        expect(askSeerInput).toHaveValue('span.duration is greater than 10ms random ');
      });
    });
  });

  describe('cross events', () => {
    it('displays the cross events dropdown', async () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
      });

      expect(
        screen.getByRole('button', {name: 'Add a cross event query'})
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Add a cross event query'})
      );

      expect(screen.getByRole('menuitemradio', {name: 'Spans'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Logs'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Metrics'})).toBeInTheDocument();
    });

    it('adds a cross event query', async () => {
      const {router} = render(
        <SpansTabContent datePageFilterProps={datePageFilterProps} />,
        {organization, additionalWrapper: Wrapper}
      );

      await userEvent.click(
        screen.getByRole('button', {name: 'Add a cross event query'})
      );

      expect(screen.getByRole('menuitemradio', {name: 'Spans'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Spans'}));

      await waitFor(() =>
        expect(router.location.query.crossEvents).toEqual(
          JSON.stringify([{query: '', type: 'spans'}])
        )
      );

      expect(trackAnalytics).toHaveBeenCalledWith(
        'trace.explorer.cross_event_added',
        expect.objectContaining({type: 'spans'})
      );
    });

    it('disables dropdown when there are 2 cross events', () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              crossEvents: JSON.stringify([
                {query: '', type: 'spans'},
                {query: '', type: 'logs'},
              ]),
            },
          },
        },
      });

      expect(
        screen.getByRole('button', {name: 'Add a cross event query'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Add a cross event query'})
      ).toBeDisabled();
    });

    it('adds a cross event search bar when cross event added', async () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Add a cross event query'})
      );

      expect(screen.getByRole('menuitemradio', {name: 'Logs'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Logs'}));

      expect(
        screen.getByPlaceholderText('Search for logs, users, tags, and more')
      ).toBeInTheDocument();
    });

    it('can remove a cross event query', async () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {crossEvents: JSON.stringify([{query: '', type: 'logs'}])},
          },
        },
      });

      expect(
        await screen.findByPlaceholderText('Search for logs, users, tags, and more')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Remove cross event search for logs'));

      expect(
        screen.queryByPlaceholderText('Search for logs, users, tags, and more')
      ).not.toBeInTheDocument();

      expect(trackAnalytics).toHaveBeenCalledWith(
        'trace.explorer.cross_event_removed',
        expect.objectContaining({type: 'logs'})
      );
    });

    it('changes the cross event search bar when dataset changed', async () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {crossEvents: JSON.stringify([{query: '', type: 'logs'}])},
          },
        },
      });

      await userEvent.click(screen.getByRole('button', {name: /Logs/}));
      await userEvent.click(screen.getByRole('option', {name: 'Metrics'}));

      expect(
        screen.getByPlaceholderText('Search for metrics, users, tags, and more')
      ).toBeInTheDocument();

      expect(trackAnalytics).toHaveBeenCalledWith(
        'trace.explorer.cross_event_changed',
        expect.objectContaining({new_type: 'metrics', old_type: 'logs'})
      );
    });

    it('renders disabled cross event search bar when the limit is reached', () => {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              crossEvents: JSON.stringify([
                {query: '', type: 'spans'},
                {query: '', type: 'logs'},
                {query: '', type: 'metrics'},
              ]),
            },
          },
        },
      });

      expect(screen.getAllByTestId('search-query-builder').pop()).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });
});

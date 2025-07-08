import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FieldKind} from 'sentry/utils/fields';
import {
  PageParamsProvider,
  useExploreFields,
  useExploreGroupBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import * as spanTagsModule from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {SpansTabContent} from 'sentry/views/explore/spans/spansTab';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {PickableDays} from 'sentry/views/explore/utils';

jest.mock('sentry/utils/analytics');

const mockStringTags: TagCollection = {
  stringTag1: {key: 'stringTag1', kind: FieldKind.TAG, name: 'stringTag1'},
  stringTag2: {key: 'stringTag2', kind: FieldKind.TAG, name: 'stringTag2'},
};

const mockNumberTags: TagCollection = {
  numberTag1: {key: 'numberTag1', kind: FieldKind.MEASUREMENT, name: 'numberTag1'},
  numberTag2: {key: 'numberTag2', kind: FieldKind.MEASUREMENT, name: 'numberTag2'},
};

const datePageFilterProps: PickableDays = {
  defaultPeriod: '7d' as const,
  maxPickableDays: 7,
  relativeOptions: ({arbitraryOptions}) => ({
    ...arbitraryOptions,
    '1h': 'Last hour',
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
  }),
};

describe('SpansTabContent', function () {
  const {organization, project} = initializeOrg();

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {period: '7d', start: null, end: null, utc: null},
      },
      new Set()
    );
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: {},
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
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      method: 'GET',
      body: {},
    });
  });

  it('should fire analytics once per change', async function () {
    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <SpansTabContent datePageFilterProps={datePageFilterProps} />
        </TraceItemAttributeProvider>
      </PageParamsProvider>,
      {organization}
    );

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

  it('inserts group bys from aggregate mode as fields in samples mode', async function () {
    let fields: string[] = [];
    let groupBys: string[] = [];
    function Component() {
      fields = useExploreFields();
      groupBys = useExploreGroupBys();
      return <SpansTabContent datePageFilterProps={datePageFilterProps} />;
    }

    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>,
      {organization}
    );

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
    await userEvent.click(within(groupBy).getByRole('button', {name: '\u2014'}));
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
  });

  describe('schema hints', function () {
    let spies: jest.SpyInstance[];

    beforeEach(function () {
      const useSpanTagsSpy = jest
        .spyOn(spanTagsModule, 'useTraceItemTags')
        .mockImplementation(type => {
          switch (type) {
            case 'number':
              return {tags: mockNumberTags, isLoading: false};
            case 'string':
              return {tags: mockStringTags, isLoading: false};
            default:
              return {tags: {}, isLoading: false};
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

    afterEach(function () {
      spies.forEach(spy => spy.mockRestore());
    });

    it('should show hints', function () {
      render(<SpansTabContent datePageFilterProps={datePageFilterProps} />, {
        organization,
      });

      expect(screen.getByText('stringTag1')).toBeInTheDocument();
      expect(screen.getByText('stringTag2')).toBeInTheDocument();
      expect(screen.getByText('numberTag1')).toBeInTheDocument();
      expect(screen.getByText('numberTag2')).toBeInTheDocument();
      expect(screen.getByText('See full list')).toBeInTheDocument();
    });
  });
});

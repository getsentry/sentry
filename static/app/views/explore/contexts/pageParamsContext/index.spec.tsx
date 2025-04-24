import {act, render} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  PageParamsProvider,
  useExplorePageParams,
  useSetExploreFields,
  useSetExploreGroupBys,
  useSetExploreId,
  useSetExploreMode,
  useSetExplorePageParams,
  useSetExploreQuery,
  useSetExploreSortBys,
  useSetExploreTitle,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  DEFAULT_VISUALIZATION,
  DEFAULT_VISUALIZATION_AGGREGATE,
  DEFAULT_VISUALIZATION_FIELD,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('defaults', function () {
  it('default', function () {
    expect(DEFAULT_VISUALIZATION).toBe('count(span.duration)');
  });

  it('default aggregate', function () {
    expect(DEFAULT_VISUALIZATION_AGGREGATE).toBe('count');
  });

  it('default field', function () {
    expect(DEFAULT_VISUALIZATION_FIELD).toBe('span.duration');
  });
});

describe('PageParamsProvider', function () {
  let pageParams: ReturnType<typeof useExplorePageParams>;
  let setPageParams: ReturnType<typeof useSetExplorePageParams>;
  let setFields: ReturnType<typeof useSetExploreFields>;
  let setGroupBys: ReturnType<typeof useSetExploreGroupBys>;
  let setMode: ReturnType<typeof useSetExploreMode>;
  let setQuery: ReturnType<typeof useSetExploreQuery>;
  let setSortBys: ReturnType<typeof useSetExploreSortBys>;
  let setVisualizes: ReturnType<typeof useSetExploreVisualizes>;
  let setId: ReturnType<typeof useSetExploreId>;
  let setTitle: ReturnType<typeof useSetExploreTitle>;

  function Component() {
    pageParams = useExplorePageParams();
    setPageParams = useSetExplorePageParams();
    setFields = useSetExploreFields();
    setGroupBys = useSetExploreGroupBys();
    setMode = useSetExploreMode();
    setQuery = useSetExploreQuery();
    setSortBys = useSetExploreSortBys();
    setVisualizes = useSetExploreVisualizes();
    setId = useSetExploreId();
    setTitle = useSetExploreTitle();
    return <br />;
  }

  function renderTestComponent(defaultPageParams?: any) {
    render(
      <PageParamsProvider>
        <Component />
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    act(() =>
      setPageParams({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp'],
        groupBys: ['span.op'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        visualizes: [
          {
            chartType: ChartType.AREA,
            label: 'A',
            yAxes: ['count(span.self_time)'],
          },
        ],
        ...defaultPageParams,
      })
    );
  }

  it('has expected default', function () {
    render(
      <PageParamsProvider>
        <Component />
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(pageParams).toEqual({
      dataset: undefined,
      fields: [
        'id',
        'span.op',
        'span.description',
        'span.duration',
        'transaction',
        'timestamp',
      ],
      groupBys: [''],
      mode: Mode.SAMPLES,
      query: '',
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      visualizes: [new Visualize(['count(span.duration)'], 'A')],
    });
  });

  it('correctly updates fields', function () {
    renderTestComponent();

    act(() => setFields(['id', 'span.op', 'timestamp']));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'span.op', 'timestamp'],
      groupBys: ['span.op'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates groupBys', function () {
    renderTestComponent();

    act(() => setGroupBys(['browser.name', 'sdk.name']));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['browser.name', 'sdk.name'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly gives default for empty groupBys', function () {
    renderTestComponent();

    act(() => setGroupBys([]));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: [''],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('permits ungrouped', function () {
    renderTestComponent();

    act(() => setGroupBys(['']));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: [''],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates mode from samples to aggregates', function () {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setMode(Mode.AGGREGATE));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates mode from aggregates to sample without group bys', function () {
    renderTestComponent({mode: Mode.AGGREGATE, groupBys: [''], sortBys: null});

    act(() => setMode(Mode.SAMPLES));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: [''],
      mode: Mode.SAMPLES,
      query: '',
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates mode from aggregates to sample with group bys', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      sortBys: null,
      fields: ['id', 'sdk.name', 'sdk.version', 'timestamp'],
      groupBys: ['sdk.name', 'sdk.version', 'span.op', ''],
    });

    act(() => setMode(Mode.SAMPLES));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'sdk.name', 'sdk.version', 'timestamp', 'span.op'],
      groupBys: ['sdk.name', 'sdk.version', 'span.op', ''],
      mode: Mode.SAMPLES,
      query: '',
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates query', function () {
    renderTestComponent();

    act(() => setQuery('foo:bar'));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op'],
      mode: Mode.AGGREGATE,
      query: 'foo:bar',
      sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates sort bys in samples mode with known field', function () {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setSortBys([{field: 'id', kind: 'desc'}]));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op'],
      mode: Mode.SAMPLES,
      query: '',
      sortBys: [{field: 'id', kind: 'desc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates sort bys in samples mode with unknown field', function () {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setSortBys([{field: 'span.op', kind: 'desc'}]));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op'],
      mode: Mode.SAMPLES,
      query: '',
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates sort bys in aggregates mode with known y axis', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['min(span.self_time)', 'max(span.duration)'],
        },
      ],
    });

    act(() => setSortBys([{field: 'max(span.duration)', kind: 'desc'}]));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'max(span.duration)', kind: 'desc'}],
      visualizes: [
        new Visualize(['min(span.self_time)', 'max(span.duration)'], 'A', ChartType.AREA),
      ],
    });
  });

  it('correctly updates sort bys in aggregates mode with unknown y axis', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['min(span.self_time)', 'max(span.duration)'],
        },
      ],
    });

    act(() => setSortBys([{field: 'avg(span.duration)', kind: 'desc'}]));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'min(span.self_time)', kind: 'desc'}],
      visualizes: [
        new Visualize(['min(span.self_time)', 'max(span.duration)'], 'A', ChartType.AREA),
      ],
    });
  });

  it('correctly updates sort bys in aggregates mode with known group by', function () {
    renderTestComponent({mode: Mode.AGGREGATE, groupBys: ['sdk.name']});

    act(() => setSortBys([{field: 'sdk.name', kind: 'desc'}]));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['sdk.name'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'sdk.name', kind: 'desc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates sort bys in aggregates mode with unknown group by', function () {
    renderTestComponent({mode: Mode.AGGREGATE, groupBys: ['sdk.name']});

    act(() => setSortBys([{field: 'sdk.version', kind: 'desc'}]));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['sdk.name'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'count(span.self_time)', kind: 'desc'}],
      visualizes: [new Visualize(['count(span.self_time)'], 'A', ChartType.AREA)],
    });
  });

  it('correctly updates visualizes with labels', function () {
    renderTestComponent();

    act(() =>
      setVisualizes([
        {
          chartType: ChartType.AREA,
          yAxes: ['count(span.self_time)'],
        },
        {
          chartType: ChartType.LINE,
          yAxes: ['avg(span.duration)', 'avg(span.self_time)'],
        },
      ])
    );

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
      visualizes: [
        new Visualize(['count(span.self_time)'], 'A', ChartType.AREA),
        new Visualize(['avg(span.duration)', 'avg(span.self_time)'], 'B', ChartType.LINE),
      ],
    });
  });

  it('correctly updates id', function () {
    renderTestComponent();
    act(() => setId('123'));
    expect(pageParams).toEqual(expect.objectContaining({id: '123'}));
  });

  it('correctly updates title', function () {
    renderTestComponent();
    act(() => setTitle('My Query'));
    expect(pageParams).toEqual(expect.objectContaining({title: 'My Query'}));
  });
});

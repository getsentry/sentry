import {act, render} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  PageParamsProvider,
  useExplorePageParams,
  useSetExploreDataset,
  useSetExploreFields,
  useSetExploreGroupBys,
  useSetExploreMode,
  useSetExplorePageParams,
  useSetExploreQuery,
  useSetExploreSortBys,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('PageParamsProvider', function () {
  let pageParams: ReturnType<typeof useExplorePageParams>;
  let setPageParams: ReturnType<typeof useSetExplorePageParams>;
  let setDataset: ReturnType<typeof useSetExploreDataset>;
  let setFields: ReturnType<typeof useSetExploreFields>;
  let setGroupBys: ReturnType<typeof useSetExploreGroupBys>;
  let setMode: ReturnType<typeof useSetExploreMode>;
  let setQuery: ReturnType<typeof useSetExploreQuery>;
  let setSortBys: ReturnType<typeof useSetExploreSortBys>;
  let setVisualizes: ReturnType<typeof useSetExploreVisualizes>;

  function Component() {
    pageParams = useExplorePageParams();
    setPageParams = useSetExplorePageParams();
    setDataset = useSetExploreDataset();
    setFields = useSetExploreFields();
    setGroupBys = useSetExploreGroupBys();
    setMode = useSetExploreMode();
    setQuery = useSetExploreQuery();
    setSortBys = useSetExploreSortBys();
    setVisualizes = useSetExploreVisualizes();
    return <br />;
  }

  function renderTestComponent(defaultPageParams?: any) {
    render(
      <PageParamsProvider>
        <Component />
      </PageParamsProvider>,
      {disableRouterMocks: true}
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
      {disableRouterMocks: true}
    );

    expect(pageParams).toEqual({
      dataset: undefined,
      fields: [
        'id',
        'project',
        'span.op',
        'span.description',
        'span.duration',
        'timestamp',
      ],
      groupBys: [''],
      mode: Mode.SAMPLES,
      query: '',
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      visualizes: [
        {
          chartType: ChartType.LINE,
          label: 'A',
          yAxes: ['avg(span.duration)'],
        },
      ],
    });
  });

  it('correctly updates dataset', function () {
    renderTestComponent();

    act(() => setDataset(DiscoverDatasets.SPANS_EAP));

    expect(pageParams).toEqual({
      dataset: DiscoverDatasets.SPANS_EAP,
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['min(span.self_time)', 'max(span.duration)'],
        },
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
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['min(span.self_time)', 'max(span.duration)'],
        },
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
      visualizes: [
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
      ],
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
        {
          chartType: ChartType.AREA,
          label: 'A',
          yAxes: ['count(span.self_time)'],
        },
        {
          chartType: ChartType.LINE,
          label: 'B',
          yAxes: ['avg(span.duration)', 'avg(span.self_time)'],
        },
      ],
    });
  });
});

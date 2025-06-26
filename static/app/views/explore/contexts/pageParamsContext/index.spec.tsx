import {OrganizationFixture} from 'sentry-fixture/organization';

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
      </PageParamsProvider>
    );

    act(() =>
      setPageParams({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          {
            chartType: ChartType.AREA,
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
      </PageParamsProvider>
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: undefined,
        fields: [
          'id',
          'span.op',
          'span.description',
          'span.duration',
          'transaction',
          'timestamp',
        ],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateFields: [{groupBy: ''}, new Visualize('count(span.duration)')],
      })
    );
  });

  it('correctly updates fields', function () {
    renderTestComponent();

    act(() => setFields(['id', 'span.op', 'timestamp']));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'span.op', 'timestamp'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates groupBys', function () {
    renderTestComponent();

    act(() => setGroupBys(['browser.name', 'sdk.name']));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'browser.name'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          {groupBy: 'sdk.name'},
        ],
      })
    );
  });

  it('correctly gives default for empty groupBys', function () {
    renderTestComponent();

    act(() => setGroupBys([]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          {groupBy: ''},
        ],
      })
    );
  });

  it('permits ungrouped', function () {
    renderTestComponent();

    act(() => setGroupBys(['']));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: ''},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates mode from samples to aggregates', function () {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setMode(Mode.AGGREGATE));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates mode from aggregates to sample without group bys', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      aggregateFields: [
        {groupBy: ''},
        {
          chartType: ChartType.AREA,
          yAxes: ['count(span.self_time)'],
        },
      ],
      sortBys: null,
    });

    act(() => setMode(Mode.SAMPLES));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateFields: [
          {groupBy: ''},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates mode from aggregates to sample with group bys', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      sortBys: null,
      fields: ['id', 'sdk.name', 'sdk.version', 'timestamp'],
      aggregateFields: [
        {groupBy: 'sdk.name'},
        {groupBy: 'sdk.version'},
        {groupBy: 'span.op'},
        {groupBy: ''},
        {
          chartType: ChartType.AREA,
          yAxes: ['count(span.self_time)'],
        },
      ],
    });

    act(() => setMode(Mode.SAMPLES));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: [
          'id',
          'sdk.name',
          'sdk.version',
          'timestamp',
          'span.self_time',
          'span.op',
        ],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          {groupBy: 'sdk.version'},
          {groupBy: 'span.op'},
          {groupBy: ''},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates query', function () {
    renderTestComponent();

    act(() => setQuery('foo:bar'));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: 'foo:bar',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in samples mode with known field', function () {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setSortBys([{field: 'id', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'id', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in samples mode with unknown field', function () {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setSortBys([{field: 'span.op', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in aggregates mode with known y axis', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      aggregateFields: [
        {groupBy: 'span.op'},
        {
          chartType: ChartType.AREA,
          yAxes: ['min(span.self_time)', 'max(span.duration)'],
        },
      ],
    });

    act(() => setSortBys([{field: 'max(span.duration)', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'max(span.duration)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('min(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          new Visualize('max(span.duration)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in aggregates mode with unknown y axis', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      aggregateFields: [
        {groupBy: 'span.op'},
        {
          chartType: ChartType.AREA,
          yAxes: ['min(span.self_time)', 'max(span.duration)'],
        },
      ],
    });

    act(() => setSortBys([{field: 'avg(span.duration)', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'min(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('min(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          new Visualize('max(span.duration)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in aggregates mode with known group by', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      aggregateFields: [
        {groupBy: 'sdk.name'},
        {
          chartType: ChartType.AREA,
          yAxes: ['count(span.self_time)'],
        },
      ],
    });

    act(() => setSortBys([{field: 'sdk.name', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'sdk.name', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in aggregates mode with unknown group by', function () {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      aggregateFields: [
        {groupBy: 'sdk.name'},
        {
          chartType: ChartType.AREA,
          yAxes: ['count(span.self_time)'],
        },
      ],
    });

    act(() => setSortBys([{field: 'sdk.version', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly gives default for empty visualizes', function () {
    renderTestComponent();

    act(() => setVisualizes([]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.duration)', kind: 'desc'}],
        aggregateFields: [{groupBy: 'span.op'}, new Visualize('count(span.duration)')],
      })
    );
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

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS_EAP_RPC,
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          new Visualize('avg(span.duration)', {
            chartType: ChartType.LINE,
          }),
          new Visualize('avg(span.self_time)', {
            chartType: ChartType.LINE,
          }),
        ],
      })
    );
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

  it('manages inserting and deleting a column when added/removed', function () {
    renderTestComponent();

    act(() =>
      setVisualizes([{yAxes: ['count(span.self_time)']}, {yAxes: ['avg(span.duration)']}])
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );

    act(() =>
      setVisualizes([
        {yAxes: ['count(span.self_time)']},
        {yAxes: ['avg(span.duration)']},
        {yAxes: ['p50(span.self_time)']},
        {yAxes: ['p75(span.duration)']},
      ])
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );

    act(() => setVisualizes([{yAxes: ['count(span.self_time)']}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time'],
      })
    );
  });

  it('only deletes 1 managed columns when there are duplicates', function () {
    renderTestComponent();

    act(() =>
      setVisualizes([{yAxes: ['count(span.self_time)']}, {yAxes: ['avg(span.duration)']}])
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );

    act(() =>
      setFields(['id', 'timestamp', 'span.self_time', 'span.duration', 'span.duration'])
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration', 'span.duration'],
      })
    );

    act(() => setVisualizes([{yAxes: ['count(span.self_time)']}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );
  });

  it('re-adds managed column if a new reference is found', function () {
    renderTestComponent();

    act(() =>
      setVisualizes([{yAxes: ['count(span.self_time)']}, {yAxes: ['avg(span.duration)']}])
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );

    act(() => setFields(['id', 'timestamp', 'span.self_time']));

    act(() =>
      setVisualizes([
        {yAxes: ['count(span.self_time)']},
        {yAxes: ['avg(span.duration)']},
        {yAxes: ['p50(span.self_time)']},
      ])
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time'],
      })
    );

    act(() =>
      setVisualizes([
        {yAxes: ['count(span.self_time)']},
        {yAxes: ['avg(span.duration)']},
        {yAxes: ['p50(span.duration)']},
      ])
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );
  });

  it('should not manage an existing column', function () {
    renderTestComponent();

    act(() => setFields(['id', 'timestamp', 'span.self_time', 'span.duration']));

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );

    act(() =>
      setVisualizes([{yAxes: ['count(span.self_time)']}, {yAxes: ['avg(span.duration)']}])
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );

    act(() => setVisualizes([{yAxes: ['count(span.self_time)']}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );
  });

  it('uses OTel-friendly default fields in OTel-friendly mode', function () {
    const organization = OrganizationFixture({
      features: ['performance-otel-friendly-ui'],
    });

    render(
      <PageParamsProvider>
        <Component />
      </PageParamsProvider>,
      {organization}
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'span.name', 'span.duration', 'timestamp'],
      })
    );
  });
});

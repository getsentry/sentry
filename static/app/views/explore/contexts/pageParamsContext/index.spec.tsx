import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  PageParamsProvider,
  useExplorePageParams,
  useSetExplorePageParams,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  DEFAULT_VISUALIZATION,
  DEFAULT_VISUALIZATION_AGGREGATE,
  DEFAULT_VISUALIZATION_FIELD,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  useSetQueryParamsAggregateSortBys,
  useSetQueryParamsFields,
  useSetQueryParamsGroupBys,
  useSetQueryParamsMode,
  useSetQueryParamsQuery,
  useSetQueryParamsSortBys,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {ChartType} from 'sentry/views/insights/common/components/chart';

function Wrapper({children}: {children: ReactNode}) {
  return (
    <SpansQueryParamsProvider>
      <PageParamsProvider>{children}</PageParamsProvider>
    </SpansQueryParamsProvider>
  );
}

describe('defaults', () => {
  it('default', () => {
    expect(DEFAULT_VISUALIZATION).toBe('count(span.duration)');
  });

  it('default aggregate', () => {
    expect(DEFAULT_VISUALIZATION_AGGREGATE).toBe('count');
  });

  it('default field', () => {
    expect(DEFAULT_VISUALIZATION_FIELD).toBe('span.duration');
  });
});

describe('PageParamsProvider', () => {
  let pageParams: ReturnType<typeof useExplorePageParams>;
  let setPageParams: ReturnType<typeof useSetExplorePageParams>;
  let setFields: ReturnType<typeof useSetQueryParamsFields>;
  let setGroupBys: ReturnType<typeof useSetQueryParamsGroupBys>;
  let setMode: ReturnType<typeof useSetQueryParamsMode>;
  let setQuery: ReturnType<typeof useSetQueryParamsQuery>;
  let setSortBys: ReturnType<typeof useSetQueryParamsSortBys>;
  let setAggregateSortBys: ReturnType<typeof useSetQueryParamsAggregateSortBys>;
  let setVisualizes: ReturnType<typeof useSetQueryParamsVisualizes>;

  function Component() {
    pageParams = useExplorePageParams();
    setPageParams = useSetExplorePageParams();
    setFields = useSetQueryParamsFields();
    setGroupBys = useSetQueryParamsGroupBys();
    setMode = useSetQueryParamsMode();
    setQuery = useSetQueryParamsQuery();
    setSortBys = useSetQueryParamsSortBys();
    setAggregateSortBys = useSetQueryParamsAggregateSortBys();
    setVisualizes = useSetQueryParamsVisualizes();
    return <br />;
  }

  function renderTestComponent(defaultPageParams?: any) {
    render(
      <Wrapper>
        <Component />
      </Wrapper>
    );

    act(() =>
      setPageParams({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
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

  it('has expected default', () => {
    render(
      <Wrapper>
        <Component />
      </Wrapper>
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
        sampleSortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.duration)', kind: 'desc'}],
        aggregateFields: [{groupBy: ''}, new Visualize('count(span.duration)')],
      })
    );
  });

  it('correctly updates fields', () => {
    renderTestComponent();

    act(() => setFields(['id', 'span.op', 'timestamp']));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'span.op', 'timestamp'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates groupBys', () => {
    renderTestComponent();

    act(() => setGroupBys(['browser.name', 'sdk.name']));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time', 'browser.name', 'sdk.name'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'browser.name'},
          {groupBy: 'sdk.name'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly gives default for empty groupBys', () => {
    renderTestComponent();

    act(() => setGroupBys([]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          {groupBy: ''},
        ],
      })
    );
  });

  it('permits ungrouped', () => {
    renderTestComponent();

    act(() => setGroupBys(['']));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: ''},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates mode from samples to aggregates', () => {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setMode(Mode.AGGREGATE));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates mode from aggregates to sample without group bys', () => {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      aggregateFields: [
        {groupBy: ''},
        {
          chartType: ChartType.AREA,
          yAxes: ['count(span.self_time)'],
        },
      ],
      sampleSortBys: null,
      aggregateSortBys: null,
    });

    act(() => setMode(Mode.SAMPLES));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: ''},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('updates fields with managed group bys', () => {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      sampleSortBys: null,
      aggregateSortBys: null,
      fields: ['id', 'timestamp'],
      aggregateFields: [
        {groupBy: 'span.description'},
        {groupBy: ''},
        {
          chartType: ChartType.AREA,
          yAxes: ['count(span.self_time)'],
        },
      ],
    });

    act(() => setGroupBys(['sdk.name', 'sdk.version']));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time', 'sdk.name', 'sdk.version'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          {groupBy: 'sdk.version'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates query', () => {
    renderTestComponent();

    act(() => setQuery('foo:bar'));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: 'foo:bar',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in samples mode with known field', () => {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setSortBys([{field: 'id', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sampleSortBys: [{field: 'id', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in samples mode with unknown field', () => {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setSortBys([{field: 'span.op', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in aggregates mode with known y axis', () => {
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

    act(() => setAggregateSortBys([{field: 'max(span.duration)', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'max(span.duration)', kind: 'desc'}],
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

  it('correctly updates sort bys in aggregates mode with unknown y axis', () => {
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

    act(() => setAggregateSortBys([{field: 'avg(span.duration)', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'min(span.self_time)', kind: 'desc'}],
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

  it('correctly updates sort bys in aggregates mode with known group by', () => {
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

    act(() => setAggregateSortBys([{field: 'sdk.name', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'sdk.name', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in aggregates mode with unknown group by', () => {
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

    act(() => setAggregateSortBys([{field: 'sdk.version', kind: 'desc'}]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          new Visualize('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly gives default for empty visualizes', () => {
    renderTestComponent();

    act(() => setVisualizes([]));

    expect(pageParams).toEqual(
      expect.objectContaining({
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.duration)', kind: 'desc'}],
        aggregateFields: [{groupBy: 'span.op'}, new Visualize('count(span.duration)')],
      })
    );
  });

  it('correctly updates visualizes with labels', () => {
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
        dataset: DiscoverDatasets.SPANS,
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
        mode: Mode.AGGREGATE,
        query: '',
        sampleSortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
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

  it('manages inserting and deleting a column when added/removed', () => {
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

  it('only deletes 1 managed columns when there are duplicates', () => {
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

  it('re-adds managed column if a new reference is found', () => {
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

  it('should not manage an existing column', () => {
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

  it('uses OTel-friendly default fields in OTel-friendly mode', () => {
    const organization = OrganizationFixture({
      features: ['performance-otel-friendly-ui'],
    });

    render(
      <Wrapper>
        <Component />
      </Wrapper>,
      {organization}
    );

    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'span.name', 'span.duration', 'timestamp'],
      })
    );
  });
});

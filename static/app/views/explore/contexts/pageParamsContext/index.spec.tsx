import type {ReactNode} from 'react';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  DEFAULT_VISUALIZATION,
  DEFAULT_VISUALIZATION_AGGREGATE,
  DEFAULT_VISUALIZATION_FIELD,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  useQueryParams,
  useSetQueryParams,
  useSetQueryParamsAggregateSortBys,
  useSetQueryParamsFields,
  useSetQueryParamsGroupBys,
  useSetQueryParamsMode,
  useSetQueryParamsQuery,
  useSetQueryParamsSortBys,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {ChartType} from 'sentry/views/insights/common/components/chart';

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
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

describe('SpanQueryParamsProvider', () => {
  let queryParams: ReturnType<typeof useQueryParams>;
  let setQueryParams: ReturnType<typeof useSetQueryParams>;
  let setFields: ReturnType<typeof useSetQueryParamsFields>;
  let setGroupBys: ReturnType<typeof useSetQueryParamsGroupBys>;
  let setMode: ReturnType<typeof useSetQueryParamsMode>;
  let setQuery: ReturnType<typeof useSetQueryParamsQuery>;
  let setSortBys: ReturnType<typeof useSetQueryParamsSortBys>;
  let setAggregateSortBys: ReturnType<typeof useSetQueryParamsAggregateSortBys>;
  let setVisualizes: ReturnType<typeof useSetQueryParamsVisualizes>;

  function Component() {
    queryParams = useQueryParams();
    setQueryParams = useSetQueryParams();
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
      setQueryParams({
        fields: ['id', 'timestamp', 'span.op'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: [
          'id',
          'span.name',
          'span.description',
          'span.duration',
          'transaction',
          'timestamp',
        ],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.duration)', kind: 'desc'}],
        aggregateFields: [{groupBy: ''}, new VisualizeFunction('count(span.duration)')],
      })
    );
  });

  it('correctly updates fields', () => {
    renderTestComponent();

    act(() => setFields(['id', 'span.op', 'timestamp']));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'span.op', 'timestamp'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates groupBys', () => {
    renderTestComponent();

    act(() => setGroupBys(['browser.name', 'sdk.name']));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: [
          'id',
          'timestamp',
          'span.op',
          'span.self_time',
          'browser.name',
          'sdk.name',
        ],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'browser.name'},
          {groupBy: 'sdk.name'},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly gives default for empty groupBys', () => {
    renderTestComponent();

    act(() => setGroupBys([]));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          new VisualizeFunction('count(span.self_time)', {
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: ''},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates mode from samples to aggregates', () => {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setMode(Mode.AGGREGATE));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('count(span.self_time)', {
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
      sortBys: null,
      aggregateSortBys: null,
    });

    act(() => setMode(Mode.SAMPLES));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: ''},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('updates fields with managed group bys', () => {
    renderTestComponent({
      mode: Mode.AGGREGATE,
      sortBys: null,
      aggregateSortBys: null,
      fields: ['id', 'timestamp', 'span.description'],
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: [
          'id',
          'timestamp',
          'span.description',
          'span.self_time',
          'sdk.name',
          'sdk.version',
        ],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          {groupBy: 'sdk.version'},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates query', () => {
    renderTestComponent();

    act(() => setQuery('foo:bar'));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: 'foo:bar',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in samples mode with known field', () => {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setSortBys([{field: 'id', kind: 'desc'}]));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'id', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly updates sort bys in samples mode with unknown field', () => {
    renderTestComponent({mode: Mode.SAMPLES});

    act(() => setSortBys([{field: 'span.op', kind: 'desc'}]));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [{field: 'span.op', kind: 'desc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('count(span.self_time)', {
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'max(span.duration)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('min(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          new VisualizeFunction('max(span.duration)', {
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'min(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('min(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          new VisualizeFunction('max(span.duration)', {
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'sdk.name', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'sdk.name', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          new VisualizeFunction('count(span.self_time)', {
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'sdk.name', 'span.self_time'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'sdk.name'},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
        ],
      })
    );
  });

  it('correctly gives default for empty visualizes', () => {
    renderTestComponent();

    act(() => setVisualizes([]));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.duration)', kind: 'desc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('count(span.duration)'),
        ],
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time', 'span.duration'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'timestamp', kind: 'asc'}],
        aggregateSortBys: [{field: 'count(span.self_time)', kind: 'asc'}],
        aggregateFields: [
          {groupBy: 'span.op'},
          new VisualizeFunction('count(span.self_time)', {
            chartType: ChartType.AREA,
          }),
          new VisualizeFunction('avg(span.duration)', {
            chartType: ChartType.LINE,
          }),
          new VisualizeFunction('avg(span.self_time)', {
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time', 'span.duration'],
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time', 'span.duration'],
      })
    );

    act(() => setVisualizes([{yAxes: ['count(span.self_time)']}]));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time'],
      })
    );
  });

  it('only deletes 1 managed columns when there are duplicates', () => {
    renderTestComponent();

    act(() =>
      setVisualizes([{yAxes: ['count(span.self_time)']}, {yAxes: ['avg(span.duration)']}])
    );

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time', 'span.duration'],
      })
    );

    act(() =>
      setFields(['id', 'timestamp', 'span.self_time', 'span.duration', 'span.duration'])
    );

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration', 'span.duration'],
      })
    );

    act(() => setVisualizes([{yAxes: ['count(span.self_time)']}]));

    expect(queryParams).toEqual(
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.op', 'span.self_time', 'span.duration'],
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

    expect(queryParams).toEqual(
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

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );
  });

  it('should not manage an existing column', () => {
    renderTestComponent();

    act(() => setFields(['id', 'timestamp', 'span.self_time', 'span.duration']));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );

    act(() =>
      setVisualizes([{yAxes: ['count(span.self_time)']}, {yAxes: ['avg(span.duration)']}])
    );

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );

    act(() => setVisualizes([{yAxes: ['count(span.self_time)']}]));

    expect(queryParams).toEqual(
      expect.objectContaining({
        fields: ['id', 'timestamp', 'span.self_time', 'span.duration'],
      })
    );
  });
});

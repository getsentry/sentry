import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DurationUnit} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';

import {
  BreakdownTotal,
  createBreakdownTotalWidget,
  getBreakdownTotalValue,
} from './breakdownTotal';

const groupedWidget: Widget = {
  id: '1',
  title: 'Tool Calls',
  interval: '1h',
  displayType: DisplayType.LINE,
  widgetType: WidgetType.SPANS,
  legendType: 'breakdown',
  limit: 3,
  queries: [
    {
      name: '',
      conditions: 'span.op:gen_ai.execute_tool',
      fields: ['gen_ai.tool.name', 'count(span.duration)'],
      aggregates: ['count(span.duration)'],
      columns: ['gen_ai.tool.name'],
      orderby: '-count(span.duration)',
    },
  ],
};

describe('createBreakdownTotalWidget', () => {
  it('creates an ungrouped table widget for the aggregate', () => {
    expect(createBreakdownTotalWidget(groupedWidget)).toEqual({
      ...groupedWidget,
      displayType: DisplayType.TABLE,
      limit: 1,
      queries: [
        {
          name: '',
          conditions: 'span.op:gen_ai.execute_tool',
          fields: ['count(span.duration)'],
          aggregates: ['count(span.duration)'],
          columns: [],
          orderby: '',
        },
      ],
    });
  });

  it('returns null for ungrouped widgets', () => {
    expect(
      createBreakdownTotalWidget({
        ...groupedWidget,
        queries: [{...groupedWidget.queries[0]!, columns: []}],
      })
    ).toBeNull();
  });

  it('returns null for widgets with multiple aggregates', () => {
    expect(
      createBreakdownTotalWidget({
        ...groupedWidget,
        queries: [
          {...groupedWidget.queries[0]!, aggregates: ['count(span.duration)', 'count()']},
        ],
      })
    ).toBeNull();
  });

  it('returns null for widgets with multiple queries', () => {
    expect(
      createBreakdownTotalWidget({
        ...groupedWidget,
        queries: [groupedWidget.queries[0]!, groupedWidget.queries[0]!],
      })
    ).toBeNull();
  });
});

describe('getBreakdownTotalValue', () => {
  const totalWidget = createBreakdownTotalWidget(groupedWidget)!;

  it('reads the aggregate from the first row', () => {
    expect(
      getBreakdownTotalValue(totalWidget, [
        {title: '', data: [{id: '1', 'count(span.duration)': 42}]},
      ])
    ).toBe(42);
  });

  it('returns null for non-numeric values', () => {
    expect(
      getBreakdownTotalValue(totalWidget, [
        {title: '', data: [{id: '1', 'count(span.duration)': ''}]},
      ])
    ).toBeNull();
  });

  it('returns undefined before results load', () => {
    expect(getBreakdownTotalValue(totalWidget, undefined)).toBeUndefined();
  });
});

describe('BreakdownTotal', () => {
  it('renders the formatted total with the period in a tooltip', async () => {
    render(
      <BreakdownTotal
        aggregate="sum(gen_ai.cost.total_tokens)"
        meta={{valueType: 'currency', valueUnit: null}}
        selection={PageFiltersFixture({
          datetime: {period: '24h', start: null, end: null, utc: null},
        })}
        value={26150}
      />
    );

    const total = screen.getByText('$26.15K');
    await userEvent.hover(total);
    expect(await screen.findByText('Total for last 24 hours')).toBeInTheDocument();
  });

  it('labels non-additive aggregates as overall values', async () => {
    render(
      <BreakdownTotal
        aggregate="avg(span.duration)"
        meta={{valueType: 'duration', valueUnit: DurationUnit.MILLISECOND}}
        selection={PageFiltersFixture({
          datetime: {period: '24h', start: null, end: null, utc: null},
        })}
        value={120}
      />
    );

    await userEvent.hover(screen.getByText('120.00ms'));
    expect(await screen.findByText('Overall for last 24 hours')).toBeInTheDocument();
  });
});

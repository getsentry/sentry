import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/types';

import {
  applySeerWidgetDefaults,
  extractDashboardFromSession,
  keepCurrentWidgetIds,
  splitDashboardPrompt,
  statusIsTerminal,
} from './createFromSeerUtils';
import type {Widget} from './types';
import {DisplayType} from './types';

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    displayType: DisplayType.LINE,
    interval: '1h',
    title: 'Test Widget',
    queries: [
      {
        name: '',
        conditions: '',
        aggregates: ['count()'],
        columns: [],
        fields: ['count()'],
        orderby: '',
      },
    ],
    ...overrides,
  };
}

function makeSession(
  overrides: Partial<NonNullable<SeerExplorerResponse['session']>> = {}
): NonNullable<SeerExplorerResponse['session']> {
  return {
    status: 'completed',
    updated_at: new Date().toISOString(),
    blocks: [],
    ...overrides,
  };
}

describe('applySeerWidgetDefaults', () => {
  describe('layout defaults', () => {
    it('fills in a full default layout when layout is undefined', () => {
      const widgets = [makeWidget({layout: undefined})];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.layout).toEqual({x: 0, y: 0, w: 2, h: 2, minH: 2});
    });

    it('fills in minH when it is missing from an existing layout', () => {
      const widgets = [
        makeWidget({
          layout: {x: 1, y: 2, w: 3, h: 4} as Widget['layout'],
        }),
      ];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.layout).toEqual({x: 1, y: 2, w: 3, h: 4, minH: 2});
    });
  });

  describe('limit defaults', () => {
    it('fills in default limit when limit is undefined', () => {
      const widgets = [makeWidget({limit: undefined})];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.limit).toBe(5);
    });
  });

  describe('query defaults', () => {
    it('fills in missing query arrays and strings', () => {
      const widgets = [
        makeWidget({
          queries: [{} as Widget['queries'][number]],
        }),
      ];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.queries).toEqual([
        {
          aggregates: [],
          columns: [],
          fields: [],
          conditions: '',
          name: '',
          orderby: '',
        },
      ]);
    });

    it('preserves existing query values', () => {
      const widgets = [makeWidget()];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.queries[0]!.aggregates).toEqual(['count()']);
      expect(result!.queries[0]!.fields).toEqual(['count()']);
    });

    it('defaults queries to an empty array when missing', () => {
      const widgets = [makeWidget({queries: undefined as unknown as Widget['queries']})];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.queries).toEqual([]);
    });
  });
});

function makeWidgetWithIds(
  widgetId: string | number | undefined,
  queryIds: Array<string | number | undefined>
): Widget {
  const base = makeWidget();
  return {
    ...base,
    id: widgetId as string | undefined,
    queries: queryIds.map(queryId => ({...base.queries[0]!, id: queryId})),
  };
}

function idsOf(widgets: Widget[]) {
  return widgets.map(widget => ({
    id: widget.id,
    queryIds: widget.queries.map(query => (query as {id?: string}).id),
  }));
}

describe('keepCurrentWidgetIds', () => {
  const currentWidgets = [
    makeWidgetWithIds('1', ['10', '11']),
    makeWidgetWithIds('2', ['20']),
  ];

  it('keeps widget and query ids that exist on the current dashboard', () => {
    const result = keepCurrentWidgetIds(
      [makeWidgetWithIds('2', ['20']), makeWidgetWithIds('1', ['11', '10'])],
      currentWidgets
    );

    expect(idsOf(result)).toEqual([
      {id: '2', queryIds: ['20']},
      {id: '1', queryIds: ['11', '10']},
    ]);
  });

  it('normalizes numeric ids to strings', () => {
    const result = keepCurrentWidgetIds([makeWidgetWithIds(1, [10])], currentWidgets);

    expect(idsOf(result)).toEqual([{id: '1', queryIds: ['10']}]);
  });

  it('drops a widget id that is not on the current dashboard, with its query ids', () => {
    const result = keepCurrentWidgetIds(
      [makeWidgetWithIds('99', ['10'])],
      currentWidgets
    );

    expect(idsOf(result)).toEqual([{id: undefined, queryIds: [undefined]}]);
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]!.queries[0]).not.toHaveProperty('id');
  });

  it('keeps a reused widget id only on its first widget', () => {
    const result = keepCurrentWidgetIds(
      [makeWidgetWithIds('1', ['10']), makeWidgetWithIds('1', ['10'])],
      currentWidgets
    );

    expect(idsOf(result)).toEqual([
      {id: '1', queryIds: ['10']},
      {id: undefined, queryIds: [undefined]},
    ]);
  });

  it('drops query ids owned by another widget or repeated within a widget', () => {
    const result = keepCurrentWidgetIds(
      [makeWidgetWithIds('1', ['20', '10', '10', undefined])],
      currentWidgets
    );

    expect(idsOf(result)).toEqual([
      {id: '1', queryIds: [undefined, '10', undefined, undefined]},
    ]);
  });

  it('drops every id when there is no current dashboard', () => {
    const result = keepCurrentWidgetIds([makeWidgetWithIds('1', ['10'])], []);

    expect(idsOf(result)).toEqual([{id: undefined, queryIds: [undefined]}]);
  });
});

describe('statusIsTerminal', () => {
  it.each(['completed', 'error', 'awaiting_user_input'])(
    'returns true for %s',
    status => {
      expect(statusIsTerminal(status)).toBe(true);
    }
  );

  it.each(['processing', 'pending', undefined, null])('returns false for %s', status => {
    expect(statusIsTerminal(status)).toBe(false);
  });
});

describe('splitDashboardPrompt', () => {
  it('splits instructions from the user query when the marker is present', () => {
    const content =
      'You are generating a Sentry dashboard. Follow these rules strictly:\n\nUser Query:\nShow me error rates by project\n';

    const {instructions, query} = splitDashboardPrompt(content);

    expect(instructions).toBe(
      'You are generating a Sentry dashboard. Follow these rules strictly:'
    );
    expect(query).toBe('Show me error rates by project');
  });

  it('returns no instructions when the marker is absent', () => {
    const content = 'Show me error rates by project';

    const {instructions, query} = splitDashboardPrompt(content);

    expect(instructions).toBeNull();
    expect(query).toBe('Show me error rates by project');
  });
});

describe('extractDashboardFromSession', () => {
  it('extracts dashboard from session blocks', () => {
    const session = makeSession({
      blocks: [
        {
          id: 'block-1',
          message: {content: 'Here is your dashboard', role: 'assistant'},
          timestamp: new Date().toISOString(),
          artifacts: [
            {
              key: 'dashboard',
              reason: 'generated',
              data: {
                title: 'My Dashboard',
                widgets: [
                  {
                    title: 'Count',
                    display_type: 'line',
                    widget_type: 'spans',
                    queries: [
                      {
                        name: '',
                        conditions: '',
                        fields: ['count()'],
                        columns: [],
                        aggregates: ['count()'],
                        orderby: '',
                      },
                    ],
                    layout: {x: 0, y: 0, w: 3, h: 2, min_h: 2},
                    interval: '1h',
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const result = extractDashboardFromSession(session);

    expect(result).not.toBeNull();
    expect(result!.title).toBe('My Dashboard');
    expect(result!.widgets).toHaveLength(1);
    expect(result!.widgets[0]!.title).toBe('Count');
    expect(result!.widgets[0]!.displayType).toBe('line');
    expect(result!.widgets[0]!.widgetType).toBe('spans');
  });

  it('keeps ids copied from the dashboard being edited', () => {
    const session = makeSession({
      blocks: [
        {
          id: 'block-1',
          message: {content: 'Updated your dashboard', role: 'assistant'},
          timestamp: new Date().toISOString(),
          artifacts: [
            {
              key: 'dashboard',
              reason: 'generated',
              data: {
                title: 'My Dashboard',
                widgets: [
                  {
                    id: '1',
                    title: 'Count',
                    display_type: 'line',
                    widget_type: 'spans',
                    queries: [{...makeWidget().queries[0]!, id: '10'}],
                    layout: {x: 0, y: 0, w: 3, h: 2, min_h: 2},
                    interval: '1h',
                  },
                  {
                    id: '99',
                    title: 'New',
                    display_type: 'line',
                    widget_type: 'spans',
                    queries: [makeWidget().queries[0]!],
                    layout: {x: 3, y: 0, w: 3, h: 2, min_h: 2},
                    interval: '1h',
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const result = extractDashboardFromSession(session, [makeWidgetWithIds('1', ['10'])]);

    expect(idsOf(result!.widgets)).toEqual([
      {id: '1', queryIds: ['10']},
      {id: undefined, queryIds: [undefined]},
    ]);
    expect(result!.widgets[0]!.tempId).toBeUndefined();
    expect(result!.widgets[1]!.tempId).toBeDefined();
  });
});

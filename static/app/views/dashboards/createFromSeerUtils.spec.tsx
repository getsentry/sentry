import {applySeerWidgetDefaults} from 'sentry/views/dashboards/createFromSeerUtils';
import {
  extractDashboardFromSession,
  statusIsTerminal,
} from 'sentry/views/dashboards/createFromSeerUtils';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';

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
    run_id: 1,
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
});

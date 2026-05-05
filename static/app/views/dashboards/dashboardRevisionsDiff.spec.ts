import {diffFilters, diffWidgets, formatProjectIds} from './dashboardRevisionsDiff';
import {DisplayType} from './types';
import type {DashboardDetails, Widget} from './types';

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: '1',
    title: 'My Widget',
    displayType: DisplayType.LINE,
    queries: [],
    interval: '1h',
    ...overrides,
  } as Widget;
}

function makeDashboard(widgets: Widget[]): DashboardDetails {
  return {
    id: '1',
    title: 'My Dashboard',
    dateCreated: '',
    widgets,
    filters: {},
    projects: [],
  } as unknown as DashboardDetails;
}

describe('diffWidgets', () => {
  it('returns added for a widget present in snapshot but not base', () => {
    const widget = makeWidget({id: '1', title: 'New Widget'});
    const result = diffWidgets(makeDashboard([]), makeDashboard([widget]));
    expect(result).toEqual([{status: 'added', widget}]);
  });

  it('returns removed for a widget present in base but not snapshot', () => {
    const widget = makeWidget({id: '1', title: 'Gone Widget'});
    const result = diffWidgets(makeDashboard([widget]), makeDashboard([]));
    expect(result).toEqual([{status: 'removed', widget}]);
  });

  it('returns empty array when widgets are identical', () => {
    const widget = makeWidget();
    const result = diffWidgets(makeDashboard([widget]), makeDashboard([widget]));
    expect(result).toEqual([]);
  });

  it('detects a title change', () => {
    const base = makeWidget({id: '1', title: 'Old Title'});
    const snap = makeWidget({id: '1', title: 'New Title'});
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result[0]).toMatchObject({
      status: 'modified',
      fields: [{field: 'title', before: 'Old Title', after: 'New Title'}],
    });
  });

  it('detects a display type change', () => {
    const base = makeWidget({id: '1', displayType: DisplayType.LINE});
    const snap = makeWidget({id: '1', displayType: DisplayType.BAR});
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result[0]).toMatchObject({
      status: 'modified',
      fields: [{field: 'display type', before: DisplayType.LINE, after: DisplayType.BAR}],
    });
  });

  it('detects a query filter change', () => {
    const base = makeWidget({
      id: '1',
      queries: [
        {
          conditions: 'level:error',
          aggregates: [],
          columns: [],
          orderby: '',
          name: '',
        } as any,
      ],
    });
    const snap = makeWidget({
      id: '1',
      queries: [
        {
          conditions: 'level:warning',
          aggregates: [],
          columns: [],
          orderby: '',
          name: '',
        } as any,
      ],
    });
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result[0]).toMatchObject({
      status: 'modified',
      fields: [{field: 'filter', before: 'level:error', after: 'level:warning'}],
    });
  });

  it('detects a layout-only change', () => {
    const base = makeWidget({id: '1', layout: {x: 0, y: 0, w: 2, h: 2, minH: 1}});
    const snap = makeWidget({id: '1', layout: {x: 2, y: 0, w: 2, h: 2, minH: 1}});
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result[0]).toMatchObject({
      status: 'modified',
      layoutChanged: true,
      fields: [],
    });
  });

  it('matches widgets by title when id differs and does not report them as added', () => {
    const base = makeWidget({id: '1', title: 'Shared Title'});
    const snap = makeWidget({id: '2', title: 'Shared Title'});
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result.find(r => r.status === 'added')).toBeUndefined();
    expect(result.find(r => r.status === 'removed')).toBeUndefined();
  });

  it('does not match by title when multiple base widgets share the same title', () => {
    const base1 = makeWidget({id: '1', title: 'Duplicate'});
    const base2 = makeWidget({id: '2', title: 'Duplicate'});
    const snap = makeWidget({id: '3', title: 'Duplicate'});
    const result = diffWidgets(makeDashboard([base1, base2]), makeDashboard([snap]));
    expect(result.find(r => r.status === 'added')).toBeDefined();
  });

  it('matches widgets by content fingerprint when IDs differ and titles are non-unique (restore case)', () => {
    // Simulates a dashboard restore where IDs are reassigned but widget content is identical.
    // Both widgets share the same default title but have distinct queries.
    const q1 = {
      conditions: 'level:error',
      aggregates: ['count()'],
      columns: [],
      orderby: '',
      name: '',
    } as any;
    const q2 = {
      conditions: 'level:warning',
      aggregates: ['count()'],
      columns: [],
      orderby: '',
      name: '',
    } as any;
    const base1 = makeWidget({id: '1', title: 'Custom Widget', queries: [q1]});
    const base2 = makeWidget({id: '2', title: 'Custom Widget', queries: [q2]});
    // After restore: new IDs, same titles, same queries
    const snap1 = makeWidget({id: '10', title: 'Custom Widget', queries: [q1]});
    const snap2 = makeWidget({id: '20', title: 'Custom Widget', queries: [q2]});
    const result = diffWidgets(
      makeDashboard([base1, base2]),
      makeDashboard([snap1, snap2])
    );
    expect(result.find(r => r.status === 'added')).toBeUndefined();
    expect(result.find(r => r.status === 'removed')).toBeUndefined();
  });

  it('matches text widgets by description fingerprint when IDs differ after restore', () => {
    const base1 = makeWidget({
      id: '1',
      title: 'Custom Widget',
      displayType: DisplayType.TEXT,
      description: 'Hello world',
      queries: [],
    });
    const base2 = makeWidget({
      id: '2',
      title: 'Custom Widget',
      displayType: DisplayType.TEXT,
      description: 'Another widget',
      queries: [],
    });
    const snap1 = makeWidget({
      id: '10',
      title: 'Custom Widget',
      displayType: DisplayType.TEXT,
      description: 'Hello world',
      queries: [],
    });
    const snap2 = makeWidget({
      id: '20',
      title: 'Custom Widget',
      displayType: DisplayType.TEXT,
      description: 'Another widget',
      queries: [],
    });
    const result = diffWidgets(
      makeDashboard([base1, base2]),
      makeDashboard([snap1, snap2])
    );
    expect(result.find(r => r.status === 'added')).toBeUndefined();
    expect(result.find(r => r.status === 'removed')).toBeUndefined();
  });

  it('treats a snapshot widget as added when its title matches a base already claimed by id', () => {
    const base = makeWidget({id: '1', title: 'Widget A'});
    const snap1 = makeWidget({id: '1', title: 'Widget B'}); // claims base by id (rename)
    const snap2 = makeWidget({id: '3', title: 'Widget A'}); // new widget with old title
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap1, snap2]));
    expect(result.find(r => r.status === 'modified' && r.widget === snap1)).toBeDefined();
    expect(result.find(r => r.status === 'added' && r.widget === snap2)).toBeDefined();
  });

  it('prefixes field names when a widget has multiple queries', () => {
    const q = {conditions: '', aggregates: [], columns: [], orderby: '', name: ''} as any;
    const base = makeWidget({id: '1', queries: [q, {...q, conditions: 'level:error'}]});
    const snap = makeWidget({id: '1', queries: [q, {...q, conditions: 'level:warning'}]});
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result[0]).toMatchObject({
      status: 'modified',
      fields: [{field: 'query 2 filter'}],
    });
  });

  it('does not flag a change when one widget has null description and the other has empty string', () => {
    const base = makeWidget({
      id: '1',
      displayType: DisplayType.TEXT,
      description: null as any,
    });
    const snap = makeWidget({id: '1', displayType: DisplayType.TEXT, description: ''});
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result).toEqual([]);
  });

  it('detects a text widget content change', () => {
    const base = makeWidget({
      id: '1',
      displayType: DisplayType.TEXT,
      description: '# Hello',
    });
    const snap = makeWidget({
      id: '1',
      displayType: DisplayType.TEXT,
      description: '# Hello World',
    });
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result[0]).toMatchObject({
      status: 'modified',
      fields: [{field: 'content', before: '# Hello', after: '# Hello World'}],
    });
  });

  it('truncates text widget content longer than 150 characters', () => {
    const long = 'x'.repeat(200);
    const base = makeWidget({id: '1', displayType: DisplayType.TEXT, description: long});
    const snap = makeWidget({
      id: '1',
      displayType: DisplayType.TEXT,
      description: long + 'y',
    });
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result[0]).toMatchObject({status: 'modified'});
    const field = (result[0] as any).fields[0];
    expect(field.before).toHaveLength(151); // 150 chars + ellipsis char
    expect(field.before.endsWith('…')).toBe(true);
    expect(field.after.endsWith('…')).toBe(true);
  });

  it('handles a query being added to a widget', () => {
    const q = {conditions: '', aggregates: [], columns: [], orderby: '', name: ''} as any;
    const base = makeWidget({id: '1', queries: [q]});
    const snap = makeWidget({id: '1', queries: [q, q]});
    const result = diffWidgets(makeDashboard([base]), makeDashboard([snap]));
    expect(result[0]).toMatchObject({
      status: 'modified',
      fields: [{field: 'query 2 query', before: '(none)', after: 'present'}],
    });
  });
});

describe('diffFilters', () => {
  function makeDash(overrides: Partial<DashboardDetails> = {}): DashboardDetails {
    return {
      id: '1',
      title: 'My Dashboard',
      dateCreated: '',
      widgets: [],
      filters: {},
      projects: [],
      ...overrides,
    } as unknown as DashboardDetails;
  }

  // Resolver that uses a slug map for known IDs, falls back to the numeric string.
  function makeResolver(slugMap: Record<number, string> = {}) {
    return (ids: number[] | undefined) => formatProjectIds(ids, id => slugMap[id]);
  }

  const resolve = makeResolver();

  it('returns no changes when base and snapshot are identical', () => {
    const dash = makeDash();
    expect(diffFilters(dash, dash, resolve)).toEqual([]);
  });

  it('returns a title change', () => {
    const result = diffFilters(
      makeDash({title: 'Old'}),
      makeDash({title: 'New'}),
      resolve
    );
    expect(result).toEqual([{label: 'Title', before: 'Old', after: 'New'}]);
  });

  it('returns a time range change for a period', () => {
    const result = diffFilters(makeDash(), makeDash({period: '14d'}), resolve);
    expect(result).toMatchObject([{label: 'Time range', after: 'Last 14 days'}]);
  });

  it('returns environment and release changes', () => {
    const result = diffFilters(
      makeDash(),
      makeDash({
        environment: ['production', 'staging'],
        filters: {release: ['v1.0.0']},
      }),
      resolve
    );
    expect(result).toContainEqual(
      expect.objectContaining({label: 'Environment', after: 'production, staging'})
    );
    expect(result).toContainEqual(
      expect.objectContaining({label: 'Releases', after: 'v1.0.0'})
    );
  });

  it('resolves project IDs to slugs via the provided resolver', () => {
    const result = diffFilters(
      makeDash(),
      makeDash({projects: [10, 11]}),
      makeResolver({10: 'backend', 11: 'frontend'})
    );
    expect(result).toEqual([
      {label: 'Projects', before: 'My Projects', after: 'backend, frontend'},
    ]);
  });

  it('resolves the all-projects sentinel (-1) to "All Projects"', () => {
    const result = diffFilters(makeDash(), makeDash({projects: [-1]}), resolve);
    expect(result).toMatchObject([{label: 'Projects', after: 'All Projects'}]);
  });

  it('resolves an empty projects list to "My Projects"', () => {
    const result = diffFilters(
      makeDash({projects: [10]}),
      makeDash({projects: []}),
      resolve
    );
    expect(result).toMatchObject([{label: 'Projects', after: 'My Projects'}]);
  });
});

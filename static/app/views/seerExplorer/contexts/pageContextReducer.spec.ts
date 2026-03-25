import {
  INITIAL_PAGE_CONTEXT_STATE,
  PageContextAction,
  pageContextReducer,
} from './pageContextReducer';

describe('pageContextReducer', () => {
  it('registers a node and nests children under it', () => {
    let state = pageContextReducer(INITIAL_PAGE_CONTEXT_STATE, {
      type: PageContextAction.REGISTER_NODE,
      nodeId: 'dash-1',
      nodeType: 'dashboard',
    });

    state = pageContextReducer(state, {
      type: PageContextAction.REGISTER_NODE,
      nodeId: 'widget-1',
      nodeType: 'widget',
      parentId: 'dash-1',
    });

    expect(state.nodes.size).toBe(1);
    const dashboard = state.nodes.get('dash-1')!;
    expect(dashboard.children.size).toBe(1);
    expect(dashboard.children.get('widget-1')!.nodeType).toBe('widget');
  });

  it('unregisters a nested node without removing the parent', () => {
    let state = pageContextReducer(INITIAL_PAGE_CONTEXT_STATE, {
      type: PageContextAction.REGISTER_NODE,
      nodeId: 'dash-1',
      nodeType: 'dashboard',
    });

    state = pageContextReducer(state, {
      type: PageContextAction.REGISTER_NODE,
      nodeId: 'widget-1',
      nodeType: 'widget',
      parentId: 'dash-1',
    });

    state = pageContextReducer(state, {
      type: PageContextAction.UNREGISTER_NODE,
      nodeId: 'widget-1',
    });

    expect(state.nodes.size).toBe(1);
    expect(state.nodes.get('dash-1')!.children.size).toBe(0);
  });

  it('merges data into a node and overwrites on subsequent updates', () => {
    let state = pageContextReducer(INITIAL_PAGE_CONTEXT_STATE, {
      type: PageContextAction.REGISTER_NODE,
      nodeId: 'dash-1',
      nodeType: 'dashboard',
    });

    state = pageContextReducer(state, {
      type: PageContextAction.UPDATE_NODE_DATA,
      nodeId: 'dash-1',
      data: {title: 'Backend Health', mode: 'view'},
    });

    state = pageContextReducer(state, {
      type: PageContextAction.UPDATE_NODE_DATA,
      nodeId: 'dash-1',
      data: {mode: 'edit'},
    });

    expect(state.nodes.get('dash-1')!.data).toEqual({
      title: 'Backend Health',
      mode: 'edit',
    });
  });

  it('returns same state when updating a nonexistent node', () => {
    const state = pageContextReducer(INITIAL_PAGE_CONTEXT_STATE, {
      type: PageContextAction.UPDATE_NODE_DATA,
      nodeId: 'nonexistent',
      data: {title: 'nope'},
    });

    expect(state).toBe(INITIAL_PAGE_CONTEXT_STATE);
  });

  it('resets all nodes', () => {
    let state = pageContextReducer(INITIAL_PAGE_CONTEXT_STATE, {
      type: PageContextAction.REGISTER_NODE,
      nodeId: 'dash-1',
      nodeType: 'dashboard',
    });

    state = pageContextReducer(state, {type: PageContextAction.RESET});

    expect(state.nodes.size).toBe(0);
    expect(state.version).toBeGreaterThan(0);
  });
});

import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

import {flamegraphSearchReducer, type FlamegraphSearch} from './flamegraphSearch';

const frame = (name: string) => ({frame: {name}}) as FlamegraphFrame;

const initialState: FlamegraphSearch = {
  highlightFrames: null,
  index: null,
  query: '',
  results: {frames: new Map(), spans: new Map()},
};

describe('flamegraphSearchReducer', () => {
  it('navigates through results based on the latest index', () => {
    const results = new Map(
      ['one', 'two', 'three'].map(name => {
        const currentFrame = frame(name);
        return [name, {frame: currentFrame, match: []}];
      })
    );
    let state = flamegraphSearchReducer(initialState, {
      type: 'set search results',
      payload: {query: 'frame', results: {frames: results, spans: new Map()}},
    });

    state = flamegraphSearchReducer(state, {type: 'next search result'});
    state = flamegraphSearchReducer(state, {type: 'next search result'});
    expect(state.index).toBe(2);

    state = flamegraphSearchReducer(state, {type: 'next search result'});
    expect(state.index).toBe(0);
  });

  it('wraps previous navigation when there is no current result', () => {
    const results = new Map([
      ['one', {frame: frame('one'), match: []}],
      ['two', {frame: frame('two'), match: []}],
    ]);
    const state = flamegraphSearchReducer(
      {...initialState, results: {frames: results, spans: new Map()}},
      {type: 'previous search result'}
    );

    expect(state.index).toBe(1);
  });
});

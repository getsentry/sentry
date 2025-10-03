import {LocationFixture} from 'sentry-fixture/locationFixture';

import {unsetQueryCursors} from './unsetQueryCursors';

describe('unsetQueryCursors', () => {
  it('returns only cursor keys set to undefined', () => {
    const location = LocationFixture({
      query: {
        tableCursor: 'abc',
        modelsCursor: 'def',
        toolsCursor: 'ghi',
        query: 'nope',
      },
    });

    expect(unsetQueryCursors(location.query)).toEqual({
      tableCursor: undefined,
      modelsCursor: undefined,
      toolsCursor: undefined,
    });
  });

  it('handles case-insensitive matching', () => {
    const location = LocationFixture({
      query: {
        TableCursor: 'abc',
        MODELS_CURSOR: 'def',
        query: 'nope',
      },
    });

    expect(unsetQueryCursors(location.query)).toEqual({
      TableCursor: undefined,
      MODELS_CURSOR: undefined,
    });
  });

  it('returns empty object for no matching keys', () => {
    const location = LocationFixture({
      query: {
        query: 'nope',
      },
    });

    expect(unsetQueryCursors(location.query)).toEqual({});
  });

  it('returns empty object when query is undefined', () => {
    const location = LocationFixture({
      query: undefined,
    });

    expect(unsetQueryCursors(location.query)).toEqual({});
  });
});

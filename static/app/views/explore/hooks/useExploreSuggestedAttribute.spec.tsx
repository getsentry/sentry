import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useExploreSuggestedAttribute} from 'sentry/views/explore/hooks/useExploreSuggestedAttribute';

const arrayAttributes: TagCollection = {
  // Tag array: stored under its backend key form, displayed as `csv_headers`.
  'tags[csv_headers,array]': {
    key: 'tags[csv_headers,array]',
    name: 'csv_headers',
    kind: FieldKind.ARRAY,
  },
  // Non-tag array: stored under its plain name.
  'some.array': {
    key: 'some.array',
    name: 'some.array',
    kind: FieldKind.ARRAY,
  },
};

function setup() {
  const {result} = renderHook(() =>
    useExploreSuggestedAttribute({
      numberAttributes: {},
      stringAttributes: {},
      booleanAttributes: {},
      arrayAttributes,
    })
  );
  return result.current;
}

describe('useExploreSuggestedAttribute', () => {
  it('does not resolve a tag array root without the [*] operator', () => {
    // The `[*]` membership operator is required; a bare root is not turned into
    // a membership filter on its own.
    expect(setup()('csv_headers')).toBeNull();
  });

  it('resolves a tag array root with [*] to its backend membership key', () => {
    expect(setup()('csv_headers[*]')).toBe('tags[csv_headers,array][*]');
  });

  it('resolves the explicit tag membership form to itself', () => {
    expect(setup()('tags[csv_headers,array][*]')).toBe('tags[csv_headers,array][*]');
  });

  it('resolves a non-tag array membership form to itself', () => {
    expect(setup()('some.array[*]')).toBe('some.array[*]');
  });
});

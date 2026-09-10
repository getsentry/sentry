import {useCallback, useState} from 'react';
import {debounce, useQueryState, type UseQueryStateOptions} from 'nuqs';

/**
 * Matches the debounce the URL writes used to sit behind, so a field being
 * typed into still reaches the URL at roughly the same cadence as before.
 */
const URL_WRITE_DEBOUNCE_MS = 300;

type SetOptions = {
  /**
   * Hold the URL write back while the value is still being edited. The value is
   * readable immediately either way; the next set without this writes at once
   * and cancels anything still pending.
   */
  debounceUrl?: boolean;
};

type SetSeededValue<T> = (value: T | null | undefined, options?: SetOptions) => void;

/**
 * What the parser makes of a param that isn't in the URL at all.
 */
function parseAbsent<T>(parser: UseQueryStateOptions<T>): T | null {
  return parser.type === 'multi' ? parser.parse([]) : parser.parse('');
}

/**
 * A nuqs query state that keeps the widget builder's pre-nuqs read semantics.
 *
 * `useLocationQuery` decoded a missing scalar as `''` rather than nothing, and
 * several of the builder's parsers turn that empty string into a real value — a
 * missing `displayType` meant a table, a missing `dataset` meant errors. nuqs
 * skips `parse` entirely for an absent key, so that value is seeded here.
 *
 * The seed is local state rather than a nuqs `withDefault` because a default is
 * re-applied on every read, and `dataset` and `limit` have to stay clearable:
 * switching to a text widget empties both, and they must stay empty.
 *
 * Values are exposed as `undefined` rather than nuqs' `null` so that builder
 * state keeps matching the shape of a `Widget`.
 */
export function useSeededQueryState<T>(
  key: string,
  parser: UseQueryStateOptions<T>
): [T | undefined, SetSeededValue<T>] {
  const [urlValue, setUrlValue] = useQueryState<T>(key, parser);

  // Wrapped in an object so that a seeded `undefined` still shadows the URL.
  const [seed, setSeed] = useState<{value: T | undefined} | null>(() =>
    urlValue === null ? {value: parseAbsent(parser) ?? undefined} : null
  );

  const setValue = useCallback<SetSeededValue<T>>(
    (value, {debounceUrl = false} = {}) => {
      // An explicit `null` clears the param but is held locally: callers rely on
      // the difference between a field that was never set and one that was
      // cleared, since only the latter should overwrite a saved widget.
      setSeed(value === null ? {value: null as T} : null);

      setUrlValue(
        value ?? null,
        debounceUrl ? {limitUrlUpdates: debounce(URL_WRITE_DEBOUNCE_MS)} : {}
      );
    },
    [setUrlValue]
  );

  return [seed ? seed.value : (urlValue ?? undefined), setValue];
}

import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';

import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import {Token} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

const EMPTY_WARNINGS: Record<string, ReactNode> = {};
const DEBOUNCE_MS = 300;

/**
 * Extracts unique filter key names from a parsed query, calls `validateFilterKeys`
 * in a debounced manner, and returns a map of key -> warning for invalid keys.
 */
export function useAsyncFilterKeyValidation(
  parsedQuery: ParseResult | null,
  validateFilterKeys?: (keys: string[]) => Promise<Record<string, ReactNode>>
): Record<string, ReactNode> {
  const [asyncWarnings, setAsyncWarnings] =
    useState<Record<string, ReactNode>>(EMPTY_WARNINGS);
  const requestCounterRef = useRef(0);

  // Extract unique filter key names from the parsed query
  const serializedKeys = useMemo(() => {
    if (!parsedQuery) {
      return '';
    }

    const keys = new Set<string>();
    for (const token of parsedQuery) {
      if (token.type === Token.FILTER) {
        keys.add(getKeyName(token.key));
      }
    }

    const sorted = [...keys].sort();
    return sorted.length > 0 ? JSON.stringify(sorted) : '';
  }, [parsedQuery]);

  const debouncedKeys = useDebouncedValue(serializedKeys, DEBOUNCE_MS);

  useEffect(() => {
    let cancelled = false;

    if (debouncedKeys && validateFilterKeys) {
      let keys: string[] | undefined;
      try {
        keys = JSON.parse(debouncedKeys);
      } catch {
        // ignore; keys stays undefined
      }

      if (keys === undefined) {
        setAsyncWarnings(EMPTY_WARNINGS);
      } else {
        const requestId = ++requestCounterRef.current;

        validateFilterKeys(keys).then(
          result => {
            if (!cancelled && requestId === requestCounterRef.current) {
              setAsyncWarnings(result);
            }
          },
          () => {
            // Fail-open: clear warnings on error
            if (!cancelled && requestId === requestCounterRef.current) {
              setAsyncWarnings(EMPTY_WARNINGS);
            }
          }
        );
      }
    } else {
      setAsyncWarnings(EMPTY_WARNINGS);
    }

    return () => {
      cancelled = true;
    };
  }, [debouncedKeys, validateFilterKeys]);

  return asyncWarnings;
}

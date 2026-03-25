import {useEffect, useRef, useState} from 'react';

import {useCommandPaletteQueryState} from 'sentry/components/commandPalette/context';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {useCommandPaletteActions} from 'sentry/components/commandPalette/useCommandPaletteActions';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

const DEFAULT_DEBOUNCE_MS = 300;

interface UseDynamicCommandPaletteActionOptions {
  /**
   * Debounce delay in milliseconds. Defaults to 300.
   */
  debounceMs?: number;
}

/**
 * Register actions that are dynamically generated from an async query.
 *
 * Reads the current command palette query from context, debounces it,
 * and calls the provided async function to generate actions. Results are
 * automatically registered with the command palette and cleaned up on
 * unmount or when results change.
 */
export function useDynamicCommandPaletteAction(
  queryAction: (query: string) => Promise<CommandPaletteAction[]>,
  options?: UseDynamicCommandPaletteActionOptions
): void {
  const {debounceMs = DEFAULT_DEBOUNCE_MS} = options ?? {};
  const {query} = useCommandPaletteQueryState();
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const [actions, setActions] = useState<CommandPaletteAction[]>([]);
  const versionRef = useRef(0);

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setActions([]);
      return;
    }

    const version = ++versionRef.current;

    queryAction(debouncedQuery).then(
      results => {
        if (version === versionRef.current) {
          setActions(results);
        }
      },
      () => {
        if (version === versionRef.current) {
          setActions([]);
        }
      }
    );
  }, [debouncedQuery, queryAction]);

  useCommandPaletteActions(actions);
}

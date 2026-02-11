/**
 * Registration-based store for tracking selected code tabs across
 * onboarding code snippets, scoped per guide instance.
 *
 * Each TabbedCodeSnippet registers a getter via useEffect on mount.
 * Registration order matches React render order (tree-order, depth-first),
 * which aligns with the order stepsToMarkdown iterates content blocks.
 * This lets us do positional matching without keys or labels.
 *
 * Scoping: A `TabSelectionScope` context provider isolates registrations
 * to the guide they belong to, preventing cross-guide contamination when
 * multiple guides are rendered simultaneously. The scope is embedded
 * inside `AuthTokenGeneratorProvider` so most surfaces get it for free.
 * Surfaces without a provider fall back to a global registry.
 */

import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';

type TabSelectionGetter = () => string;

/** Global fallback for when no TabSelectionScope provider is present. */
const _globalRegistrations: TabSelectionGetter[] = [];

const TabRegistryContext = createContext<MutableRefObject<TabSelectionGetter[]> | null>(
  null
);

/**
 * Scopes tab selection registrations to a specific guide instance.
 * Rendered inside AuthTokenGeneratorProvider so most onboarding
 * surfaces inherit scoping automatically.
 */
export function TabSelectionScope({children}: {children: React.ReactNode}) {
  const registryRef = useRef<TabSelectionGetter[]>([]);
  return (
    <TabRegistryContext.Provider value={registryRef}>
      {children}
    </TabRegistryContext.Provider>
  );
}

/**
 * Returns scoped register/getSelections functions for the nearest
 * TabSelectionScope (or the global fallback).
 *
 * - `register(getter)` — called by TabbedCodeSnippet in a useEffect.
 *   Returns a cleanup function.
 * - `getSelections()` — called by OnboardingCopyMarkdownButton at
 *   click time. Returns an ordered array of selected tab labels.
 */
export function useTabRegistry() {
  const registryRef = useContext(TabRegistryContext);
  const registry = registryRef?.current ?? _globalRegistrations;

  const register = useCallback(
    (getter: TabSelectionGetter): (() => void) => {
      registry.push(getter);
      return () => {
        const idx = registry.indexOf(getter);
        if (idx !== -1) {
          registry.splice(idx, 1);
        }
      };
    },
    [registry]
  );

  const getSelections = useCallback((): string[] => {
    return registry.map(fn => fn());
  }, [registry]);

  return {register, getSelections};
}

/**
 * Combined hook that manages tab selection state AND registers a getter
 * with the scoped registry. This is the single source of truth for a
 * TabbedCodeSnippet's selected tab — the same value drives both the UI
 * and the Copy as Markdown output.
 *
 * Returns [selectedValue, setSelectedValue] like useState.
 */
export function useRegisteredTabSelection(
  initialValue: string
): [string, (value: string) => void] {
  const {register} = useTabRegistry();
  const [selectedValue, setSelectedValue] = useState(initialValue);

  const valueRef = useRef(selectedValue);
  valueRef.current = selectedValue;

  useEffect(() => {
    return register(() => valueRef.current);
  }, [register]);

  return [selectedValue, setSelectedValue];
}

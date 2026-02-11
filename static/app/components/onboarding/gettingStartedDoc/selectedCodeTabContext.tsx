/**
 * Scoped store for tracking selected code tabs across onboarding snippets.
 *
 * Selections are stored in a scope-level Map keyed by tab labels, so they
 * persist across component mount/unmount cycles (e.g. when GuidedSteps
 * navigates between steps). A `TabSelectionScope` context provider
 * isolates selections per guide instance, preventing cross-guide
 * contamination when multiple guides render simultaneously. The scope
 * is embedded inside `AuthTokenGeneratorProvider` so most surfaces get
 * it for free.
 */

import {createContext, useCallback, useContext, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';

type TabSelectionsMap = Map<string, string>;

const TabRegistryContext = createContext<MutableRefObject<TabSelectionsMap> | null>(null);

/** Global fallback for surfaces without a TabSelectionScope provider. */
const _globalSelections: TabSelectionsMap = new Map();

const StepIndexContext = createContext<number | undefined>(undefined);

/**
 * Provides the current step index to descendant TabbedCodeSnippets.
 * Rendered by the Step component so that tab selection keys include the
 * step index, preventing collisions when different steps have tabs with
 * identical labels.
 */
export function StepIndexProvider({
  index,
  children,
}: {
  children: React.ReactNode;
  index: number;
}) {
  return <StepIndexContext.Provider value={index}>{children}</StepIndexContext.Provider>;
}

/**
 * Derives a stable key from a set of tab labels, optionally prefixed
 * with a step index for disambiguation. Used to match component-side
 * selections with content-block-side lookups in stepsToMarkdown.
 */
export function deriveTabKey(
  tabs: ReadonlyArray<{label: string}>,
  stepIndex?: number
): string {
  const labelPart = tabs.map(t => t.label).join('\0');
  return stepIndex === undefined ? labelPart : `${stepIndex}:${labelPart}`;
}

/**
 * Scopes tab selections to a specific guide instance.
 * Rendered inside AuthTokenGeneratorProvider so most onboarding
 * surfaces inherit scoping automatically.
 */
export function TabSelectionScope({children}: {children: React.ReactNode}) {
  const mapRef = useRef<TabSelectionsMap>(new Map());
  return (
    <TabRegistryContext.Provider value={mapRef}>{children}</TabRegistryContext.Provider>
  );
}

function useSelectionsMap(): TabSelectionsMap {
  const mapRef = useContext(TabRegistryContext);
  return mapRef?.current ?? _globalSelections;
}

/**
 * Manages tab selection state for a TabbedCodeSnippet, persisted in the
 * nearest TabSelectionScope. The stored selection survives component
 * unmount/remount (e.g. when GuidedSteps navigates between steps).
 *
 * Returns [selectedValue, setSelectedValue] like useState.
 */
export function useRegisteredTabSelection(
  tabs: ReadonlyArray<{label: string; value: string}>
): [string, (value: string) => void] {
  const map = useSelectionsMap();
  const stepIndex = useContext(StepIndexContext);
  const key = deriveTabKey(tabs, stepIndex);

  // Restore previous selection if available (e.g. after step navigation)
  const storedLabel = map.get(key);
  const restoredTab = storedLabel ? tabs.find(t => t.label === storedLabel) : undefined;
  const [selectedValue, setSelectedValue] = useState(
    restoredTab?.value ?? tabs[0]!.value
  );

  // Keep map in sync — derive label from current value
  const currentTab = tabs.find(t => t.value === selectedValue) ?? tabs[0]!;
  map.set(key, currentTab.label);

  // Use a ref for tabs to keep setValue stable across renders
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const setValue = useCallback(
    (newValue: string) => {
      const tab = tabsRef.current.find(t => t.value === newValue) ?? tabsRef.current[0]!;
      map.set(key, tab.label);
      setSelectedValue(newValue);
    },
    [map, key]
  );

  return [selectedValue, setValue];
}

/**
 * Returns the scope's tab selections map for use in stepsToMarkdown.
 * Keys are derived from tab labels via deriveTabKey.
 */
export function useTabSelectionsMap(): ReadonlyMap<string, string> {
  return useSelectionsMap();
}

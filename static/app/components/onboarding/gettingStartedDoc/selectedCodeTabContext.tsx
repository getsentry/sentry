/**
 * Scoped store for tracking selected code tabs across onboarding snippets.
 *
 * Selections are stored in a scope-level Map (via useRef) keyed by
 * deriveTabKey, so they persist across component mount/unmount cycles
 * (e.g. when GuidedSteps navigates between steps). A `TabSelectionScope`
 * context provider isolates selections per guide instance, preventing
 * cross-guide contamination when multiple guides render simultaneously.
 *
 * The map is a ref (not state) because it's a write-on-interaction /
 * read-on-copy side-channel — tab changes shouldn't re-render the
 * entire provider tree.
 */

import {createContext, useCallback, useContext, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';

type TabSelectionsMap = Map<string, string>;

const TabRegistryContext = createContext<MutableRefObject<TabSelectionsMap> | null>(null);

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
 * Every onboarding surface should wrap its content with this provider.
 */
export function TabSelectionScope({children}: {children: React.ReactNode}) {
  const mapRef = useRef<TabSelectionsMap>(new Map());
  return (
    <TabRegistryContext.Provider value={mapRef}>{children}</TabRegistryContext.Provider>
  );
}

/**
 * Manages tab selection state for a TabbedCodeSnippet, persisted in the
 * nearest TabSelectionScope. The stored selection survives component
 * unmount/remount (e.g. when GuidedSteps navigates between steps).
 *
 * Only writes to the scope map on explicit user interaction (setValue),
 * not during render. stepsToMarkdown falls back to the first tab when
 * no selection is stored, so unvisited tabs don't need a default entry.
 *
 * Returns [selectedValue, setSelectedValue] like useState.
 */
export function useRegisteredTabSelection(
  tabs: ReadonlyArray<{label: string; value: string}>
): [string, (value: string) => void] {
  const mapRef = useContext(TabRegistryContext);
  const stepIndex = useContext(StepIndexContext);
  const key = deriveTabKey(tabs, stepIndex);

  // Restore previous selection if available (e.g. after step navigation)
  const storedLabel = mapRef?.current.get(key);
  const restoredTab = storedLabel ? tabs.find(t => t.label === storedLabel) : undefined;
  const [selectedValue, setSelectedValue] = useState(
    restoredTab?.value ?? tabs[0]!.value
  );

  // Use a ref for tabs to keep setValue stable across renders
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const setValue = useCallback(
    (newValue: string) => {
      const tab = tabsRef.current.find(t => t.value === newValue) ?? tabsRef.current[0]!;
      mapRef?.current.set(key, tab.label);
      setSelectedValue(newValue);
    },
    [mapRef, key]
  );

  return [selectedValue, setValue];
}

/**
 * Returns the scope's tab selections map for use in stepsToMarkdown.
 * Keys are derived from tab labels via deriveTabKey.
 */
export function useTabSelectionsMap(): ReadonlyMap<string, string> {
  const mapRef = useContext(TabRegistryContext);
  return mapRef?.current ?? new Map();
}

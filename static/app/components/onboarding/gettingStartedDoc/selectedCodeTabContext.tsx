/**
 * Scoped store for tracking selected code tabs across onboarding snippets.
 *
 * Tab selections live as React state in `TabSelectionScope`, keyed by
 * deriveTabKey. This lets selections persist across component
 * mount/unmount cycles (e.g. when GuidedSteps navigates between steps)
 * and isolates selections per guide instance, preventing cross-guide
 * contamination when multiple guides render simultaneously.
 */

import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

type TabSelectionsState = {
  selections: ReadonlyMap<string, string>;
  setSelection: (key: string, label: string) => void;
};

const TabRegistryContext = createContext<TabSelectionsState | null>(null);

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
  const [selections, setSelections] = useState<ReadonlyMap<string, string>>(
    () => new Map()
  );

  const setSelection = useCallback((key: string, label: string) => {
    setSelections(prev => {
      const next = new Map(prev);
      next.set(key, label);
      return next;
    });
  }, []);

  const value = useMemo(() => ({selections, setSelection}), [selections, setSelection]);

  return (
    <TabRegistryContext.Provider value={value}>{children}</TabRegistryContext.Provider>
  );
}

/**
 * Manages tab selection state for a TabbedCodeSnippet, backed by the
 * nearest TabSelectionScope. The selection survives component
 * unmount/remount (e.g. when GuidedSteps navigates between steps)
 * because state lives in the provider, not in the component.
 *
 * Returns [selectedValue, setSelectedValue] like useState.
 */
export function useRegisteredTabSelection(
  tabs: ReadonlyArray<{label: string; value: string}>
): [string, (value: string) => void] {
  const ctx = useContext(TabRegistryContext);
  const stepIndex = useContext(StepIndexContext);
  const key = deriveTabKey(tabs, stepIndex);

  // Derive selected value from provider state
  const storedLabel = ctx?.selections.get(key);
  const selectedTab = storedLabel
    ? (tabs.find(t => t.label === storedLabel) ?? tabs[0]!)
    : tabs[0]!;

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const setValue = useCallback(
    (newValue: string) => {
      const tab = tabsRef.current.find(t => t.value === newValue) ?? tabsRef.current[0]!;
      ctx?.setSelection(key, tab.label);
    },
    [ctx, key]
  );

  return [selectedTab.value, setValue];
}

/**
 * Returns the scope's tab selections map for use in stepsToMarkdown.
 * Keys are derived from tab labels via deriveTabKey.
 */
export function useTabSelectionsMap(): ReadonlyMap<string, string> {
  const ctx = useContext(TabRegistryContext);
  return ctx?.selections ?? _emptyMap;
}

const _emptyMap: ReadonlyMap<string, string> = new Map();

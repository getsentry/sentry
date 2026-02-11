/**
 * Scoped store for tracking selected code tabs across onboarding snippets.
 *
 * Tab selections live as React state in `TabSelectionScope`, keyed by
 * deriveTabKey. This lets selections persist across component
 * mount/unmount cycles (e.g. when GuidedSteps navigates between steps)
 * and isolates selections per guide instance, preventing cross-guide
 * contamination when multiple guides render simultaneously.
 */

import {createContext, useCallback, useContext, useMemo, useState} from 'react';

type TabSelectionsState = {
  selections: ReadonlyMap<string, string>;
  setSelection: (key: string, value: string) => void;
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
 * with a step index for disambiguation. When multiple tabbed blocks
 * in the same step share identical labels (e.g. dotnet's two
 * "Package Manager / .NET Core CLI" groups), a fingerprint of the
 * first tab's code content is appended to make the key unique.
 *
 * Used to match component-side selections with content-block-side
 * lookups in stepsToMarkdown.
 */
export function deriveTabKey(
  tabs: ReadonlyArray<{label: string; code?: string}>,
  stepIndex?: number
): string {
  const labelPart = tabs.map(t => t.label).join('\0');
  // Include a code fingerprint to disambiguate tabbed blocks with
  // identical labels within the same step (e.g. dotnet install step
  // has two "Package Manager / .NET Core CLI" tab groups).
  const codeFp = tabs[0]?.code?.slice(0, 50) ?? '';
  const base = codeFp ? `${labelPart}\x01${codeFp}` : labelPart;
  return stepIndex === undefined ? base : `${stepIndex}:${base}`;
}

/**
 * Scopes tab selections to a specific guide instance.
 * Every onboarding surface should wrap its content with this provider.
 */
export function TabSelectionScope({children}: {children: React.ReactNode}) {
  const [selections, setSelections] = useState<ReadonlyMap<string, string>>(
    () => new Map()
  );

  const setSelection = useCallback((key: string, value: string) => {
    setSelections(prev => {
      const next = new Map(prev);
      next.set(key, value);
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
  tabs: ReadonlyArray<{label: string; value: string; code?: string}>
): [string, (value: string) => void] {
  const ctx = useContext(TabRegistryContext);
  const stepIndex = useContext(StepIndexContext);
  const key = deriveTabKey(tabs, stepIndex);

  // value === label (set in defaultRenderers.tsx), so we store and
  // return values directly without conversion.
  const storedValue = ctx?.selections.get(key);
  const selectedValue = storedValue
    ? (tabs.find(t => t.value === storedValue)?.value ?? tabs[0]!.value)
    : tabs[0]!.value;

  const setValue = useCallback(
    (newValue: string) => {
      ctx?.setSelection(key, newValue);
    },
    [ctx, key]
  );

  return [selectedValue, setValue];
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

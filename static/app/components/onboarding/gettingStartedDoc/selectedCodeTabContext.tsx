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
 * Tracks the position of a content block within the step's content tree.
 * Builds a path like "1" (top-level block 1) or "2_1" (block 1 inside
 * conditional block 2). Used to disambiguate tabbed code blocks that
 * share identical labels within the same step.
 */
const BlockPathContext = createContext<string>('');

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
 * Wraps a content block to extend the block path with its index.
 * Used by renderBlocks to build nested paths like "2_1" for blocks
 * inside conditional blocks.
 */
export function BlockPathProvider({
  index,
  children,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const parentPath = useContext(BlockPathContext);
  const path = parentPath ? `${parentPath}_${index}` : `${index}`;
  return <BlockPathContext.Provider value={path}>{children}</BlockPathContext.Provider>;
}

/**
 * Derives a stable key from a set of tab labels, optionally prefixed
 * with a step index and block path for disambiguation.
 *
 * The block path differentiates multiple tabbed blocks with identical
 * labels within the same step (e.g. dotnet install step has two
 * "Package Manager / .NET Core CLI" tab groups at paths "1" and "2_1").
 *
 * Used to match component-side selections with content-block-side
 * lookups in stepsToMarkdown.
 */
export function deriveTabKey(
  tabs: ReadonlyArray<{label: string}>,
  stepIndex?: number,
  blockPath?: string
): string {
  const labelPart = tabs.map(t => t.label).join('\0');
  const pathPart = blockPath ? `\x01${blockPath}` : '';
  const base = `${labelPart}${pathPart}`;
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
 * Falls back to local useState when no TabSelectionScope is present,
 * preserving backward compatibility for standalone TabbedCodeSnippets.
 *
 * Returns [selectedValue, setSelectedValue] like useState.
 */
export function useRegisteredTabSelection(
  tabs: ReadonlyArray<{label: string; value: string}>
): [string, (value: string) => void] {
  const ctx = useContext(TabRegistryContext);
  const stepIndex = useContext(StepIndexContext);
  const blockPath = useContext(BlockPathContext);
  const key = deriveTabKey(tabs, stepIndex, blockPath || undefined);

  // Local fallback when no TabSelectionScope is present (e.g.
  // screensLandingPage.tsx renders TabbedCodeSnippet standalone).
  const [localValue, setLocalValue] = useState(tabs[0]!.value);

  const storedValue = ctx ? ctx.selections.get(key) : localValue;
  const selectedValue = storedValue
    ? (tabs.find(t => t.value === storedValue)?.value ?? tabs[0]!.value)
    : tabs[0]!.value;

  const setValue = useCallback(
    (newValue: string) => {
      if (ctx) {
        ctx.setSelection(key, newValue);
      } else {
        setLocalValue(newValue);
      }
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

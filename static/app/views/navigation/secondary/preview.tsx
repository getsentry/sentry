import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';
import {useFocusManager} from '@react-aria/focus';

import {Container} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';

interface SecondaryNavigationPreviewContextValue {
  /**
   * Called when a link in the preview navigates, so the preview can close.
   * Modified clicks that open a new tab or window do not navigate.
   */
  onNavigate: () => void;
  /**
   * Focus the first tab, or the first link without tabs, once the preview
   * knows which of the two it shows.
   */
  autoFocus?: boolean;
}

/**
 * Renders a secondary navigation as a preview card instead of a sidebar:
 * without its header, with sections that cannot collapse, and with labeled
 * sections split into tabs.
 */
export const SecondaryNavigationPreviewContext =
  createContext<SecondaryNavigationPreviewContextValue | null>(null);

export function useSecondaryNavigationPreview() {
  return useContext(SecondaryNavigationPreviewContext);
}

/**
 * Whether a click on a preview link navigates in place, rather than opening a
 * new tab or window.
 */
export function isPreviewNavigationClick(event: React.MouseEvent) {
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

interface PreviewTab {
  id: string;
  key: string;
  /**
   * Sections with the same label share one tab. Sections without a label keep
   * the preview as one list.
   */
  label: string | undefined;
}

interface PreviewTabGroup {
  /** The id of the first section in the tab. */
  id: string;
  keys: string[];
  label: string;
}

interface PreviewTabsRegistry {
  /** The tab panel that is open, which the selected tab renders into. */
  panel: {element: HTMLElement; id: string} | null;
  removeTab: (key: string) => void;
  setTab: (tab: PreviewTab) => void;
  tabGroups: PreviewTabGroup[];
  /** Whether the preview is split into tabs, or shows every section as one list. */
  tabbed: boolean;
  tabs: PreviewTab[];
}

/**
 * Provided by the preview body. Set back to null inside a tab, so sections
 * nested in a tab do not register their own.
 */
const PreviewTabsContext = createContext<PreviewTabsRegistry | null>(null);

function groupTabsByLabel(tabs: PreviewTab[]): PreviewTabGroup[] | null {
  const groups = new Map<string, PreviewTabGroup>();
  for (const {id, key, label} of tabs) {
    if (label === undefined) {
      return null;
    }
    const group = groups.get(label);
    if (group) {
      group.keys.push(key);
    } else {
      groups.set(label, {id, keys: [key], label});
    }
  }
  return [...groups.values()];
}

export function SecondaryNavigationPreviewBody({children}: {children: ReactNode}) {
  const preview = useSecondaryNavigationPreview();
  const focusManager = useFocusManager();
  const [tabs, setTabs] = useState<PreviewTab[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PreviewTabsRegistry['panel']>(null);

  // Tabs register in mount order, which is document order for the sections
  // rendered with the body. A section that mounts later is added at the end.
  const setTab = useCallback((tab: PreviewTab) => {
    setTabs(prev => {
      const index = prev.findIndex(({key}) => key === tab.key);
      if (index === -1) {
        return [...prev, tab];
      }
      const current = prev[index]!;
      if (current.id === tab.id && current.label === tab.label) {
        return prev;
      }
      return prev.map(existing => (existing === current ? tab : existing));
    });
  }, []);
  const removeTab = useCallback((key: string) => {
    setTabs(prev => prev.filter(tab => tab.key !== key));
  }, []);
  const setPanelElement = useCallback((id: string, element: HTMLElement | null) => {
    setPanel(prev => (element ? {id, element} : prev?.id === id ? null : prev));
  }, []);

  const tabGroups = useMemo(() => groupTabsByLabel(tabs) ?? [], [tabs]);
  const tabbed = tabGroups.length > 1;
  const selectedTab = tabGroups.find(group => group.id === selectedId) ?? tabGroups[0];

  const registry = useMemo(
    () => ({panel, removeTab, setTab, tabGroups, tabbed, tabs}),
    [panel, removeTab, setTab, tabGroups, tabbed, tabs]
  );

  // Autofocus has to wait for the sections to register, because until then
  // the preview renders neither its tabs nor its links. The first tab is not
  // tabbable yet at that point, so this focuses the first focusable element.
  const shouldAutoFocus = useRef(preview?.autoFocus ?? false);
  useLayoutEffect(() => {
    if (shouldAutoFocus.current && tabs.length > 0) {
      shouldAutoFocus.current = false;
      focusManager?.focusFirst();
    }
  }, [focusManager, tabs]);

  return (
    <PreviewTabsContext value={registry}>
      {tabbed && selectedTab ? (
        <Tabs size="sm" value={selectedTab.id} onChange={setSelectedId}>
          {({TabList, TabPanels}) => (
            <Fragment>
              <Container borderBottom="primary" padding="0 md">
                <TabList aria-label={t('Navigation sections')}>
                  {tabGroups.map(({id, label}) => (
                    <TabList.Item key={id}>{label}</TabList.Item>
                  ))}
                </TabList>
              </Container>
              <TabPanels>
                {tabGroups.map(({id}) => (
                  <TabPanels.Item key={id}>
                    <PreviewTabPanel id={id} onElementChange={setPanelElement} />
                  </TabPanels.Item>
                ))}
              </TabPanels>
            </Fragment>
          )}
        </Tabs>
      ) : null}
      <Container padding="0 md">{children}</Container>
    </PreviewTabsContext>
  );
}

interface PreviewTabPanelProps {
  id: string;
  onElementChange: (id: string, element: HTMLElement | null) => void;
}

function PreviewTabPanel({id, onElementChange}: PreviewTabPanelProps) {
  const ref = useCallback(
    (element: HTMLDivElement | null) => onElementChange(id, element),
    [id, onElementChange]
  );

  return <Container ref={ref} padding="0 md" />;
}

interface SecondaryNavigationPreviewTabProps {
  children: ReactNode;
  id: string;
  label: string | undefined;
  /** Rendered above the content when it follows another section in its tab. */
  separator: ReactNode;
}

/**
 * Makes its content one tab of a preview, or part of the tab with the same
 * label. Outside a preview body, or inside another tab, it renders its content
 * unchanged.
 */
export function SecondaryNavigationPreviewTab(props: SecondaryNavigationPreviewTabProps) {
  const registry = useContext(PreviewTabsContext);

  if (!registry) {
    return props.children;
  }

  return <RegisteredPreviewTab {...props} registry={registry} />;
}

function RegisteredPreviewTab({
  children,
  id,
  label,
  registry,
  separator,
}: SecondaryNavigationPreviewTabProps & {registry: PreviewTabsRegistry}) {
  const key = useId();
  const {setTab, removeTab, tabbed, tabGroups, tabs, panel} = registry;

  useLayoutEffect(() => setTab({id, key, label}), [setTab, id, key, label]);
  useLayoutEffect(() => () => removeTab(key), [removeTab, key]);

  if (!tabbed) {
    // Render nothing until registered, so a preview that turns out to have
    // tabs does not mount every section first.
    return tabs.some(tab => tab.key === key) ? (
      <PreviewTabsContext value={null}>{children}</PreviewTabsContext>
    ) : null;
  }

  const group = tabGroups.find(({keys}) => keys.includes(key));
  if (!group || !panel || panel.id !== group.id) {
    return null;
  }

  return createPortal(
    <PreviewTabsContext value={null}>
      {group.keys[0] === key ? null : separator}
      {children}
    </PreviewTabsContext>,
    panel.element
  );
}

/**
 * Separators between tabs are hidden, because each tab shows on its own.
 */
export function useIsHiddenBetweenPreviewTabs() {
  return useContext(PreviewTabsContext)?.tabbed ?? false;
}

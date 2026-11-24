import type * as React from 'react';
import {createContext, useContext, useMemo} from 'react';
import type {ListState} from '@react-stately/list';
import type {Key, Node} from '@react-types/shared';

import {SectionHeader, SectionLabel} from '@sentry/scraps/menu';
import type {FormSize} from '@sentry/scraps/theme';
import {
  estimateRowHeight,
  flattenSections,
  getWidestKey,
  useVirtualCollection,
  VirtualRows,
  type VirtualRowProps,
} from '@sentry/scraps/useVirtualCollection';

import {SECTION_SEPARATOR_HEIGHT, SectionSeparator} from './styles';
import type {ListItemBase} from './types';
import {getVisibleOptionPositions, SectionToggle, type OptionPosition} from './utils';

/**
 * The element that several lists scroll in together, such as the regions of a
 * CompositeSelect. A list inside it virtualizes against it instead of its own
 * scroll area, which does not scroll.
 */
export const SharedScrollElementContext = createContext<HTMLElement | null>(null);

/** What a section's own row holds, above the section's options. */
interface SectionRowLayout {
  /** Set when the section shows a header. */
  header: {toggleAllButton: boolean} | null;
  separator: boolean;
}

export interface SelectSectionRow<T extends ListItemBase> {
  layout: SectionRowLayout;
  node: Node<T>;
  /** Measurement props for the section's own row, when virtualized. */
  rowProps: VirtualRowProps | undefined;
}

interface SelectOptionRow<T extends ListItemBase> {
  node: Node<T>;
  /** Set when virtualized, see `getVisibleOptionPositions`. */
  position: OptionPosition | undefined;
  /**
   * Measurement props for the option, when virtualized. Pass `data-index` and
   * `ref` to the option as separate props: they keep their identity, so a
   * memoized option that did not change skips rendering on scroll.
   */
  rowProps: VirtualRowProps | undefined;
}

interface SelectRowsProps<T extends ListItemBase> {
  hiddenOptions: ReadonlySet<Key>;
  /** The visible top-level nodes of the list's collection. */
  listItems: Array<Node<T>>;
  /** The list element the rows render directly inside. */
  listRef: React.RefObject<HTMLElement | null>;
  renderOption: (row: SelectOptionRow<T>) => React.ReactNode;
  renderSection: (
    section: SelectSectionRow<T>,
    options: React.ReactNode
  ) => React.ReactNode;
  /**
   * The element that scrolls, an ancestor of the rows. Passed as a value rather
   * than a ref: an ancestor's ref is attached after the rows' layout effects
   * run, so the virtualizer would find no element on mount and not render
   * again to look for it.
   */
  scrollElement: HTMLElement | null;
  selectionManager: ListState<T>['selectionManager'];
  showSectionHeaders: boolean;
  size: FormSize;
  virtualized: boolean;
}

/**
 * Renders the options of a CompactSelect list, each inside its section, and
 * virtualizes them when `virtualized` is set.
 *
 * The virtualizer re-renders the component that calls it on every scroll.
 * Calling it here, rather than in the list, keeps those re-renders to the rows:
 * the list's state and render functions keep their identity, so a memoized
 * option that did not change is not re-rendered.
 */
export function SelectRows<T extends ListItemBase>({
  hiddenOptions,
  listItems,
  listRef,
  renderOption,
  renderSection,
  scrollElement,
  selectionManager,
  showSectionHeaders,
  size,
  virtualized,
}: SelectRowsProps<T>) {
  // The published package is built without the React Compiler, so memoize by
  // hand what must keep its identity while scrolling re-renders this component:
  // new positions would re-render every memoized option, and a new scroll ref
  // would re-run the virtualizer's list offset effect.
  const positions = useMemo(
    () => (virtualized ? getVisibleOptionPositions(listItems, hiddenOptions) : undefined),
    [virtualized, listItems, hiddenOptions]
  );

  const pinnedKeys = useMemo(() => {
    if (!virtualized) {
      return [];
    }
    const options = flattenSections(listItems, hiddenOptions).filter(
      node => node.type !== 'section'
    );
    const focusableOptions = options.filter(
      node => !selectionManager.isDisabled(node.key)
    );
    return [
      // The overlay sizes its width to the rows. Keep the visible option with the
      // longest label mounted, so a virtualized list does not change width as
      // other options scroll into view.
      getWidestKey(options),
      // Opening the menu, leaving the search and moving focus between the lists
      // of a CompositeSelect find these options in the DOM.
      options.find(node => selectionManager.isSelected(node.key))?.key,
      focusableOptions[0]?.key,
      focusableOptions.at(-1)?.key,
    ];
  }, [virtualized, listItems, hiddenOptions, selectionManager]);

  const sharedScrollElement = useContext(SharedScrollElementContext);
  const activeScrollElement = sharedScrollElement ?? scrollElement;
  const scrollRef = useMemo(
    () => ({current: activeScrollElement}),
    [activeScrollElement]
  );

  const getSectionLayout = (section: Node<T>): SectionRowLayout => {
    const toggleAllButton =
      selectionManager.selectionMode === 'multiple' &&
      Boolean(section.value?.showToggleAllButton);
    return {
      // Only the sections below the first are separated from the rows above.
      separator: showSectionHeaders && section.key !== listItems[0]?.key,
      header:
        showSectionHeaders && (Boolean(section.rendered) || toggleAllButton)
          ? {toggleAllButton}
          : null,
    };
  };

  const virtual = useVirtualCollection({
    collection: listItems,
    hiddenKeys: hiddenOptions,
    enabled: virtualized,
    estimateSize: node => {
      if (node.type !== 'section') {
        return estimateRowHeight(node, undefined, size, 0);
      }
      const layout = getSectionLayout(node);
      const separator = layout.separator ? SECTION_SEPARATOR_HEIGHT : 0;
      const header = layout.header ? estimateRowHeight(node, undefined, size, 0) : 0;
      return separator + header;
    },
    focusedKey: selectionManager.focusedKey,
    listRef,
    scrollRef,
    size,
    pinnedKeys,
  });

  return (
    <VirtualRows
      virtual={virtual}
      renderRow={({node, props}) =>
        renderOption({node, position: positions?.get(node.key), rowProps: props})
      }
      renderSection={(section, options) =>
        renderSection(
          {
            layout: getSectionLayout(section.node),
            node: section.node,
            rowProps: section.props,
          },
          options
        )
      }
    />
  );
}

interface SectionRowProps<T extends ListItemBase> {
  /** Props for the section's label, which names the section's group. */
  labelProps: React.HTMLAttributes<HTMLElement>;
  listState: ListState<T>;
  section: SelectSectionRow<T>;
}

/**
 * The row above a section's options: its separator and header. Rendered even
 * when empty, so a virtualized row has an element to measure.
 */
export function SectionRow<T extends ListItemBase>({
  labelProps,
  listState,
  section: {layout, node, rowProps},
}: SectionRowProps<T>) {
  return (
    <div {...rowProps}>
      {layout.separator && <SectionSeparator />}
      {layout.header && (
        <SectionHeader
          trailingAction={
            layout.header.toggleAllButton ? (
              <SectionToggle item={node} listState={listState} />
            ) : null
          }
        >
          {node.rendered && <SectionLabel {...labelProps}>{node.rendered}</SectionLabel>}
        </SectionHeader>
      )}
    </div>
  );
}

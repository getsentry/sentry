import type * as React from 'react';
import {useMemo} from 'react';
import type {Key, Node, SelectionMode} from '@react-types/shared';

import type {FormSize} from '@sentry/scraps/theme';
import {
  estimateRowHeight,
  flattenSections,
  getWidestKey,
  useVirtualCollection,
  VirtualRows,
  type VirtualRowProps,
} from '@sentry/scraps/useVirtualCollection';

import {SECTION_SEPARATOR_HEIGHT} from './styles';
import type {ListItemBase} from './types';

/** What a section's own row holds, above the section's options. */
export interface SectionRowLayout {
  header: boolean;
  separator: boolean;
  toggleAllButton: boolean;
}

export interface SelectSectionRow<T extends ListItemBase> {
  layout: SectionRowLayout;
  node: Node<T>;
  /** Measurement props for the section's own row, when virtualized. */
  rowProps: VirtualRowProps | undefined;
}

export interface SelectOptionRow<T extends ListItemBase> {
  node: Node<T>;
  /**
   * Measurement props for the option, when virtualized. Pass `data-index` and
   * `ref` to the option as separate props: they keep their identity, so a
   * memoized option that did not change skips rendering on scroll.
   */
  rowProps: VirtualRowProps | undefined;
}

interface SelectRowsProps<T extends ListItemBase> {
  focusedKey: Key | null;
  hiddenOptions: ReadonlySet<Key>;
  /** The visible top-level nodes of the list's collection. */
  listItems: Array<Node<T>>;
  /** Vertical CSS padding (px) of the list, at each end. */
  listPadding: number;
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
  selectionMode: SelectionMode;
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
  focusedKey,
  hiddenOptions,
  listItems,
  listPadding,
  renderOption,
  renderSection,
  scrollElement,
  selectionMode,
  showSectionHeaders,
  size,
  virtualized,
}: SelectRowsProps<T>) {
  // The overlay sizes its width to the rows. Keep the visible option with the
  // longest label mounted, so a virtualized list does not change width as other
  // options scroll into view.
  const widestKey = useMemo(
    () =>
      virtualized ? getWidestKey(flattenSections(listItems, hiddenOptions)) : undefined,
    [virtualized, listItems, hiddenOptions]
  );

  const scrollRef = useMemo(() => ({current: scrollElement}), [scrollElement]);

  const getSectionLayout = (section: Node<T>): SectionRowLayout => {
    const toggleAllButton =
      selectionMode === 'multiple' && Boolean(section.value?.showToggleAllButton);
    return {
      // Only the sections below the first are separated from the rows above.
      separator: showSectionHeaders && section.key !== listItems[0]?.key,
      header: showSectionHeaders && (Boolean(section.rendered) || toggleAllButton),
      toggleAllButton,
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
    focusedKey,
    listPadding,
    scrollRef,
    size,
    widestKey,
  });

  return (
    <VirtualRows
      virtual={virtual}
      renderRow={({node, props}) => renderOption({node, rowProps: props})}
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

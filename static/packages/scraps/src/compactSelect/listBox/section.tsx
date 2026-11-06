import type * as React from 'react';
import {useListBoxSection} from '@react-aria/listbox';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {SectionSeparator} from '@sentry/scraps/compactSelect/styles';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';
import {SectionToggle} from '@sentry/scraps/compactSelect/utils';
import {
  SectionGroup,
  SectionHeader,
  SectionLabel,
  SectionList,
} from '@sentry/scraps/menu';
import type {VirtualRowProps} from '@sentry/scraps/useVirtualCollection';

interface ListBoxSectionProps<T extends ListItemBase> {
  /** The section's options, rendered inside its group. */
  children: React.ReactNode;
  item: Node<T>;
  listState: ListState<T>;
  showSectionHeaders: boolean;
  /** False for a section at the top of the list, which needs no separator. */
  showSeparator: boolean;
  /**
   * Measurement props for the section's own row when the list is virtualized.
   * The row holds the separator and header above the section's options.
   */
  rowProps?: VirtualRowProps;
}

/**
 * A <li /> element that functions as a list box section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function ListBoxSection<T extends ListItemBase>({
  children,
  item,
  listState,
  showSectionHeaders,
  showSeparator,
  rowProps,
}: ListBoxSectionProps<T>) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: item.rendered,
    'aria-label': item['aria-label'],
  });

  const showToggleAllButton =
    listState.selectionManager.selectionMode === 'multiple' &&
    item.value?.showToggleAllButton;

  return (
    <SectionGroup {...itemProps}>
      {/* Rendered even without headers, so a virtualized row has an element
          to measure. */}
      <div {...rowProps}>
        {showSectionHeaders && showSeparator && <SectionSeparator />}
        {showSectionHeaders && (item.rendered || showToggleAllButton) && (
          <SectionHeader
            trailingAction={
              showToggleAllButton ? (
                <SectionToggle item={item} listState={listState} />
              ) : null
            }
          >
            {item.rendered && (
              <SectionLabel {...headingProps}>{item.rendered}</SectionLabel>
            )}
          </SectionHeader>
        )}
      </div>
      <SectionList {...groupProps}>{children}</SectionList>
    </SectionGroup>
  );
}

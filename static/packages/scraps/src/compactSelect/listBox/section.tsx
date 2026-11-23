import type * as React from 'react';
import {useListBoxSection} from '@react-aria/listbox';
import type {ListState} from '@react-stately/list';

import {SectionRow, type SelectSectionRow} from '@sentry/scraps/compactSelect/selectRows';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';
import {SectionGroup, SectionList} from '@sentry/scraps/menu';

interface ListBoxSectionProps<T extends ListItemBase> {
  /** The section's options, rendered inside its group. */
  children: React.ReactNode;
  listState: ListState<T>;
  section: SelectSectionRow<T>;
}

/**
 * A <li /> element that functions as a list box section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function ListBoxSection<T extends ListItemBase>({
  children,
  listState,
  section,
}: ListBoxSectionProps<T>) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: section.node.rendered,
    'aria-label': section.node['aria-label'],
  });

  return (
    <SectionGroup {...itemProps}>
      <SectionRow section={section} listState={listState} labelProps={headingProps} />
      <SectionList {...groupProps}>{children}</SectionList>
    </SectionGroup>
  );
}

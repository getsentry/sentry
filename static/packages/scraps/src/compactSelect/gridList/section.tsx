import type * as React from 'react';
import {useId} from 'react';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {SectionRowLayout} from '@sentry/scraps/compactSelect/selectRows';
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

interface GridListSectionProps<T extends ListItemBase> {
  /** The section's options, rendered inside its group. */
  children: React.ReactNode;
  layout: SectionRowLayout;
  listState: ListState<T>;
  node: Node<T>;
  /**
   * Measurement props for the section's own row when the list is virtualized.
   * The row holds the separator and header above the section's options.
   */
  rowProps?: VirtualRowProps;
}

/**
 * A <li /> element that functions as a grid list section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListSection<T extends ListItemBase>({
  children,
  layout,
  node,
  listState,
  rowProps,
}: GridListSectionProps<T>) {
  const titleId = useId();

  return (
    <SectionGroup
      role="rowgroup"
      {...(node['aria-label']
        ? {'aria-label': node['aria-label']}
        : {'aria-labelledby': titleId})}
    >
      <div {...rowProps}>
        {layout.separator && <SectionSeparator />}
        {layout.header && (
          <SectionHeader
            trailingAction={
              layout.toggleAllButton ? (
                <SectionToggle item={node} listState={listState} />
              ) : null
            }
          >
            {node.rendered && (
              <SectionLabel id={titleId} aria-hidden>
                {node.rendered}
              </SectionLabel>
            )}
          </SectionHeader>
        )}
      </div>
      <SectionList>{children}</SectionList>
    </SectionGroup>
  );
}

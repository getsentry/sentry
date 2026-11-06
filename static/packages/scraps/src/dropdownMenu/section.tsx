import type * as React from 'react';
import {useMenuSection} from '@react-aria/menu';
import type {Node} from '@react-types/shared';

import {SectionGroup, SectionLabel, SectionList} from '@sentry/scraps/menu';
import type {VirtualRowProps} from '@sentry/scraps/useVirtualCollection';

import type {MenuItemProps} from './item';

type DropdownMenuSectionProps = {
  children: React.ReactNode;
  node: Node<MenuItemProps>;
  /**
   * Measurement props for the section's own row when the menu is virtualized.
   * The row holds the separator and heading above the section's items.
   */
  rowProps?: VirtualRowProps;
  /** Rendered above the heading, inside the section's row. */
  separator?: React.ReactNode;
};

/**
 * A wrapper component for menu sections. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
export function DropdownMenuSection({
  node,
  children,
  rowProps,
  separator,
}: DropdownMenuSectionProps) {
  const {itemProps, headingProps, groupProps} = useMenuSection({
    heading: node.rendered,
    'aria-label': node['aria-label'],
  });

  const heading = node.rendered && (
    <SectionLabel padding="md xl" size="md" {...headingProps}>
      {node.rendered}
    </SectionLabel>
  );

  return (
    <SectionGroup ref={node.value?.ref} {...itemProps}>
      <div {...rowProps}>
        {separator}
        {heading}
      </div>
      <SectionList {...groupProps}>{children}</SectionList>
    </SectionGroup>
  );
}

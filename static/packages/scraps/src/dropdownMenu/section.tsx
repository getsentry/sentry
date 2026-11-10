import type * as React from 'react';
import styled from '@emotion/styled';
import {useMenuSection} from '@react-aria/menu';
import type {Node} from '@react-types/shared';

import {
  SECTION_ITEM_SPACE,
  SectionGroup,
  SectionLabel,
  SectionList,
} from '@sentry/scraps/menu';
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
      <DropdownMenuSectionList {...groupProps}>{children}</DropdownMenuSectionList>
    </SectionGroup>
  );
}

/**
 * Spaces the items of a section apart with top padding on every item but the
 * first, marked by `DropdownMenuItem`. A `gap` would also space the spacer
 * elements of a virtualized menu, and padding is measured as part of the
 * row's height.
 *
 * The second selector matches a submenu trigger, which `DropdownSubmenu`
 * wraps in a `display: contents` list item.
 */
const DropdownMenuSectionList = styled(SectionList)`
  & > [data-section-item]:not([data-first-in-section]),
  & > li > [data-section-item]:not([data-first-in-section]) {
    padding-top: ${p => p.theme.space[SECTION_ITEM_SPACE]};
  }
`;

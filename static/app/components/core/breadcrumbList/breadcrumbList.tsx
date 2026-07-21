import {Container, Flex, useHasContainerQuery} from '@sentry/scraps/layout';

import {unreachable} from 'sentry/utils/unreachable';

import type {BreadcrumbItemLinkProps} from './items/breadcrumbItemLink';
import {BreadcrumbItemLink} from './items/breadcrumbItemLink';
import {BreadcrumbItemMenuBreadcrumbs} from './items/breadcrumbItemMenuBreadcrumbs';
import type {BreadcrumbItemPageTitleProps} from './items/breadcrumbItemPageTitle';
import {BreadcrumbItemPageTitle} from './items/breadcrumbItemPageTitle';
import type {BreadcrumbItemPageTitleEditableProps} from './items/breadcrumbItemPageTitleEditable';
import {BreadcrumbItemPageTitleEditable} from './items/breadcrumbItemPageTitleEditable';
import type {BreadcrumbItemSelectProjectsProps} from './items/breadcrumbItemSelectProjects';
import {BreadcrumbItemSelectProjects} from './items/breadcrumbItemSelectProjects';
import {BreadcrumbDividerCombo} from './breadcrumbDividerCombo';

type LinkBreadcrumbItem = {type: 'link'} & BreadcrumbItemLinkProps;
type PageTitleBreadcrumbItem = {
  type: 'page-title';
} & BreadcrumbItemPageTitleProps;
type EditableTitleBreadcrumbItem = {
  type: 'editable-title';
} & BreadcrumbItemPageTitleEditableProps;
type SelectProjectsBreadcrumbItem = {
  type: 'select-projects';
} & BreadcrumbItemSelectProjectsProps;

type BreadcrumbItem = LinkBreadcrumbItem | SelectProjectsBreadcrumbItem;
export type BreadcrumbTitleItem = PageTitleBreadcrumbItem | EditableTitleBreadcrumbItem;

export interface BreadcrumbListProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

interface BreadcrumbListTitleProps {
  item: BreadcrumbTitleItem;
}

function renderItem(item: BreadcrumbItem) {
  // Strip the `type` discriminant so it never leaks onto the sub-component.
  switch (item.type) {
    case 'link': {
      const {type: _type, ...props} = item;
      return <BreadcrumbItemLink {...props} />;
    }
    case 'select-projects': {
      const {type: _type, ...props} = item;
      return <BreadcrumbItemSelectProjects {...props} />;
    }
    default:
      unreachable(item);
      return null;
  }
}

function BreadCrumbTitle({item}: BreadcrumbListTitleProps) {
  switch (item.type) {
    case 'page-title': {
      const {type: _type, ...props} = item;
      return <BreadcrumbItemPageTitle {...props} />;
    }
    case 'editable-title': {
      const {type: _type, ...props} = item;
      return <BreadcrumbItemPageTitleEditable {...props} />;
    }
    default:
      unreachable(item);
      return null;
  }
}

/**
 * Renders a horizontal breadcrumb trail. Uses a container query to collapse
 * parent link crumbs into an overflow (…) menu when the container is narrow
 * (below the 'xs' breakpoint — 500px).
 *
 * Consumers pass parent crumbs in `items` and render the final page title with
 * `BreadcrumbList.Title`. Keeping those concerns separate means the TopBar can
 * own the page's single heading.
 *
 * Overflow behaviour:
 * - Wide (≥ 500px): all parent items render individually
 * - Narrow (< 500px): parent items hide and link parents collapse into a single
 *   BreadcrumbItemMenuBreadcrumbs overflow button; non-link parents (e.g.
 *   'select-projects') just hide.
 */
export function BreadcrumbList({items, ...props}: BreadcrumbListProps) {
  const hasParentQueryContainer = useHasContainerQuery();

  if (items.length === 0) {
    return null;
  }

  // Collect link items for the overflow menu (narrow layout)
  const menuItems = items
    .filter(item => item.type === 'link')
    .map((item, index) => ({
      label: item.label,
      to: item.to,
      leadingItems: item.leadingGraphic,
      // Include the index so two crumbs pointing at the same destination don't
      // collide on key. The list is static and never reordered, so the index is a stable identifier.
      key: `${index}`,
    }));

  // Responsive display values using container queries (bare breakpoint keys):
  //   '2xs' is the smallest breakpoint → applies as the base
  //   'xs'  = 500px → overrides at container width ≥ 500px
  const visibleWhenWide = {xs: 'flex', '2xs': 'none'} as const;
  const visibleWhenNarrow = {xs: 'none', '2xs': 'flex'} as const;

  return (
    // Renders parent links as inline content (no <nav> landmark). The TopBar
    // title slot owns the page heading, so this list only contains supporting
    // parent links.
    <Container width="100%" {...props}>
      {/*
       * When there is already a query container (for example, the flexible
       * content region in TopBar), use it instead of introducing inline-size
       * containment into the content-sized breadcrumbs flex item. Standalone
       * BreadcrumbLists establish their own container here.
       */}
      <Container
        containerType={hasParentQueryContainer ? 'normal' : 'inline-size'}
        width="100%"
      >
        <Flex as="ol" align="center" gap="xs" padding="md 0" margin="0" wrap="nowrap">
          {items.map((item, index) => (
            // Wide: show every item. Narrow: hide them all — 'link' parents
            // reappear in the overflow menu below; other types (e.g. 'select-projects')
            // simply collapse out of view.
            <BreadcrumbDividerCombo key={index} display={visibleWhenWide}>
              {renderItem(item)}
            </BreadcrumbDividerCombo>
          ))}

          {/* Overflow menu — only visible in narrow layout when there are link items to collapse */}
          {menuItems.length > 0 && (
            <BreadcrumbDividerCombo display={visibleWhenNarrow}>
              <BreadcrumbItemMenuBreadcrumbs items={menuItems} />
            </BreadcrumbDividerCombo>
          )}
        </Flex>
      </Container>
    </Container>
  );
}

BreadcrumbList.Title = BreadCrumbTitle;

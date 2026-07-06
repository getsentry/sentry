import {Container, Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

import type {BreadcrumbItemLinkProps} from './items/breadcrumbItemLink';
import {BreadcrumbItemLink} from './items/breadcrumbItemLink';
import {BreadcrumbItemMenuBreadcrumbs} from './items/breadcrumbItemMenuBreadcrumbs';
import type {BreadcrumbItemPageTitleProps} from './items/breadcrumbItemPageTitle';
import {BreadcrumbItemPageTitle} from './items/breadcrumbItemPageTitle';
import type {BreadcrumbItemSelectProjectsProps} from './items/breadcrumbItemSelectProjects';
import {BreadcrumbItemSelectProjects} from './items/breadcrumbItemSelectProjects';
import {BreadcrumbDividerCombo} from './breadcrumbDividerCombo';

export type BreadcrumbItem =
  | {props: BreadcrumbItemLinkProps; type: 'link'}
  | {props: BreadcrumbItemPageTitleProps; type: 'page-title'}
  | {props: BreadcrumbItemSelectProjectsProps; type: 'select-projects'};

export interface BreadcrumbListProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

function renderItem(item: BreadcrumbItem) {
  switch (item.type) {
    case 'link':
      return <BreadcrumbItemLink {...item.props} />;
    case 'page-title':
      return <BreadcrumbItemPageTitle {...item.props} />;
    case 'select-projects':
      return <BreadcrumbItemSelectProjects {...item.props} />;
    default:
      return null;
  }
}

/**
 * Renders a horizontal breadcrumb trail. Uses a container query to collapse
 * parent link crumbs into an overflow (…) menu when the container is narrow
 * (below the 'sm' breakpoint — 800px).
 *
 * Consumers pass a typed `items` array so each breadcrumb slot has an explicit
 * variant — no implicit inference based on position.
 *
 * Overflow behaviour:
 * - Wide (≥ 800px): all items render individually
 * - Narrow (< 800px): all 'link' type parent items collapse into a single
 *   BreadcrumbItemMenuBreadcrumbs overflow button; other parent types remain visible
 */
export function BreadcrumbList({items, ...props}: BreadcrumbListProps) {
  if (items.length === 0) {
    return null;
  }

  const lastItem = items[items.length - 1]!;
  const parentItems = items.slice(0, -1);

  // Collect link items for the overflow menu (narrow layout)
  const collapsibleLinkItems = parentItems.filter(
    (item): item is Extract<BreadcrumbItem, {type: 'link'}> => item.type === 'link'
  );
  const menuItems = collapsibleLinkItems.map(item => ({
    label: item.props.label,
    to: item.props.to,
  }));

  // Responsive display values using container queries (bare breakpoint keys):
  //   '2xs' is the smallest breakpoint → applies as the base
  //   'sm'  = 800px → overrides at container width ≥ 800px
  const showWide = {sm: 'flex', '2xs': 'none'} as const;
  const showNarrow = {sm: 'none', '2xs': 'flex'} as const;

  return (
    // containerType="inline-size" makes this element a container for @container queries.
    // Must use the standard children form (not render-prop) to use containerType.
    <Container
      as="nav"
      containerType="inline-size"
      aria-label={t('Breadcrumbs')}
      data-test-id="breadcrumb-list"
      {...props}
    >
      <Flex as="ol" align="center" gap="xs" padding="md 0" wrap="nowrap">
        {parentItems.map((item, index) => {
          const isLinkItem = item.type === 'link';
          return (
            // Wide: show all parent items; Narrow: hide link items (they go in the menu)
            <BreadcrumbDividerCombo
              key={index}
              display={isLinkItem ? showWide : undefined}
            >
              {renderItem(item)}
            </BreadcrumbDividerCombo>
          );
        })}

        {/* Overflow menu — only visible in narrow layout when there are link items to collapse */}
        {menuItems.length > 0 && (
          <BreadcrumbDividerCombo display={showNarrow}>
            <BreadcrumbItemMenuBreadcrumbs items={menuItems} />
          </BreadcrumbDividerCombo>
        )}

        {/* Page title — always visible, no divider after it */}
        <Container as="li" display="contents">
          {renderItem(lastItem)}
        </Container>
      </Flex>
    </Container>
  );
}

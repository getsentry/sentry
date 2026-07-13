import {Container, Flex, type Responsive} from '@sentry/scraps/layout';

import {BreadcrumbCopyAction} from './actions/breadcrumbCopyAction';
import {BreadcrumbMenuAction} from './actions/breadcrumbMenuAction';
import type {BreadcrumbItemLinkProps} from './items/breadcrumbItemLink';
import {BreadcrumbItemLink} from './items/breadcrumbItemLink';
import {BreadcrumbItemMenuBreadcrumbs} from './items/breadcrumbItemMenuBreadcrumbs';
import type {BreadcrumbItemPageTitleProps} from './items/breadcrumbItemPageTitle';
import {BreadcrumbItemPageTitle} from './items/breadcrumbItemPageTitle';
import type {BreadcrumbItemPageTitleEditableProps} from './items/breadcrumbItemPageTitleEditable';
import {
  BreadcrumbEditableTitle,
  BreadcrumbItemPageTitleEditable,
} from './items/breadcrumbItemPageTitleEditable';
import type {BreadcrumbItemSelectProjectsProps} from './items/breadcrumbItemSelectProjects';
import {BreadcrumbItemSelectProjects} from './items/breadcrumbItemSelectProjects';
import {BreadcrumbDividerCombo} from './breadcrumbDividerCombo';

/** @public Public API of the redesigned breadcrumbs; consumers migrate onto it in a downstream PR. */
export type BreadcrumbItem =
  | ({type: 'link'} & BreadcrumbItemLinkProps)
  | ({type: 'page-title'} & BreadcrumbItemPageTitleProps)
  | ({type: 'editable-title'} & BreadcrumbItemPageTitleEditableProps)
  | ({type: 'select-projects'} & BreadcrumbItemSelectProjectsProps);

/** @public Public API of the redesigned breadcrumbs; consumers migrate onto it in a downstream PR. */
export interface BreadcrumbListProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

function renderItem(item: BreadcrumbItem) {
  // Strip the `type` discriminant so it never leaks onto the sub-component.
  switch (item.type) {
    case 'link': {
      const {type: _type, ...props} = item;
      return <BreadcrumbItemLink {...props} />;
    }
    case 'page-title': {
      const {type: _type, ...props} = item;
      return <BreadcrumbItemPageTitle {...props} />;
    }
    case 'editable-title': {
      const {type: _type, ...props} = item;
      return <BreadcrumbItemPageTitleEditable {...props} />;
    }
    case 'select-projects': {
      const {type: _type, ...props} = item;
      return <BreadcrumbItemSelectProjects {...props} />;
    }
    default:
      return null;
  }
}

/**
 * Renders a horizontal breadcrumb trail. Uses a container query to collapse
 * parent link crumbs into an overflow (…) menu when the container is narrow
 * (below the 'xs' breakpoint — 500px).
 *
 * Consumers pass a typed `items` array so each breadcrumb slot has an explicit
 * variant — no implicit inference based on position.
 *
 * Overflow behaviour:
 * - Wide (≥ 500px): all items render individually
 * - Narrow (< 500px): every parent item is hidden, leaving only the last crumb.
 *   'link' parents additionally collapse into a single BreadcrumbItemMenuBreadcrumbs
 *   overflow button; non-link parents (e.g. 'select-projects') just hide.
 *
 * @public Consumed once call sites migrate onto the typed API in a downstream PR.
 */
function BreadcrumbListRoot({items, ...props}: BreadcrumbListProps) {
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
    label: item.label,
    to: item.to,
  }));

  // Responsive display values using container queries (bare breakpoint keys):
  //   '2xs' is the smallest breakpoint → applies as the base
  //   'xs'  = 500px → overrides at container width ≥ 500px
  const visibleWhenWide: Responsive<'flex' | 'none'> = {xs: 'flex', '2xs': 'none'};
  const visibleWhenNarrow: Responsive<'flex' | 'none'> = {xs: 'none', '2xs': 'flex'};

  return (
    // Renders as inline content (no <nav> landmark, no own heading): breadcrumbs
    // are placed inside the page heading (e.g. the TopBar title <h1>), which owns
    // the landmark/heading semantics. A `<nav aria-label>` here would both nest
    // invalidly and override that <h1>'s accessible name.
    <Container width="100%" data-test-id="breadcrumb-list" {...props}>
      {/*
       * The query container is this inner element, not the <nav> above. emotion's
       * `as` swap on a styled component bypasses the wrapper that strips
       * `containerType`, so pairing `as="nav"` with `containerType` would leak the
       * prop onto the DOM node. Keeping `containerType` on an un-swapped Container
       * (rendered as a plain div) lets the primitive strip it as intended while
       * still establishing the container at full width — the @container collapse
       * below resolves against it either way.
       */}
      <Container containerType="inline-size" width="100%">
        <Flex as="ol" align="center" gap="xs" padding="md 0" margin="0" wrap="nowrap">
          {parentItems.map((item, index) => (
            // Wide: show every parent item. Narrow: hide them all — 'link' parents
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

          {/* Page title — always visible, no divider after it */}
          <Container as="li" display="contents">
            {renderItem(lastItem)}
          </Container>
        </Flex>
      </Container>
    </Container>
  );
}

/**
 * Compound component. Element-slot parts (`EditableTitle`) and trailing-action
 * parts (`CopyAction`, `MenuAction`) are attached here so consumers pass typed
 * elements into item props rather than arbitrary ReactNodes.
 *
 * @public Consumed once call sites migrate onto the typed API in a downstream PR.
 */
export const BreadcrumbList = Object.assign(BreadcrumbListRoot, {
  EditableTitle: BreadcrumbEditableTitle,
  CopyAction: BreadcrumbCopyAction,
  MenuAction: BreadcrumbMenuAction,
});

import {Children, Fragment, isValidElement} from 'react';

import type {SelectKey, SelectOptionOrSection} from '@sentry/scraps/compactSelect';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';

import {
  ListItem,
  MenuItem,
  MenuSection,
  MenuSectionLabel,
  MenuSectionSeparator,
  Submenu,
} from './declarations';
import {MenuFooter, MenuHeader} from './layout';

type Element = React.ReactElement;

function isElementOf<Props>(
  element: Element,
  component: (props: Props) => React.ReactNode
): element is React.ReactElement<Props> {
  return element.type === component;
}

function elements(children: React.ReactNode): Element[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{children?: React.ReactNode}>(child)) {
      return [];
    }
    if (child.type === Fragment) {
      return elements(child.props.children);
    }
    return [child];
  });
}

function sectionContent(children: React.ReactNode) {
  const parts = elements(children);
  const label = parts.find(part => isElementOf(part, MenuSectionLabel));
  return {
    label:
      label && isElementOf(label, MenuSectionLabel) ? label.props.children : undefined,
    items: parts.filter(part => part.type !== MenuSectionLabel),
  };
}

interface ComposedCollection<T> {
  items: T[];
  separatorBeforeKeys: Set<string>;
  footer?: React.ReactNode;
  header?: React.ReactNode;
}

export function composeMenu(
  children: React.ReactNode
): ComposedCollection<MenuItemProps> {
  const result: ComposedCollection<MenuItemProps> = {
    items: [],
    separatorBeforeKeys: new Set(),
  };
  let separatorPending = false;

  for (const part of elements(children)) {
    if (part.type === MenuHeader) {
      result.header = part;
      continue;
    }
    if (part.type === MenuFooter) {
      result.footer = part;
      continue;
    }
    if (part.type === MenuSectionSeparator) {
      const previous = result.items.at(-1);
      if (separatorPending || !previous?.children || previous.submenu) {
        throw new Error('MenuSectionSeparator must be placed between sections');
      }
      separatorPending = true;
      continue;
    }

    if (separatorPending && part.type !== MenuSection) {
      throw new Error('MenuSectionSeparator must be placed between sections');
    }

    let item: MenuItemProps | undefined;
    if (isElementOf(part, MenuSection)) {
      const {sectionKey, children: sectionChildren, ...rest} = part.props;
      const {label, items} = sectionContent(sectionChildren);
      if ((label === null || label === undefined) && !rest['aria-label']) {
        throw new Error('MenuSection requires MenuSectionLabel or aria-label');
      }
      const section = composeMenu(items);
      for (const key of section.separatorBeforeKeys) {
        result.separatorBeforeKeys.add(key);
      }
      item = {
        ...rest,
        key: String(sectionKey ?? `section-${result.items.length}`),
        label,
        children: section.items,
      };
    } else if (isElementOf(part, Submenu)) {
      const {itemKey, children: submenuChildren, title, position, ...rest} = part.props;
      const submenu = composeMenu(submenuChildren);
      item = {
        ...rest,
        key: itemKey,
        children: submenu.items,
        submenu: {
          title,
          position,
          header: submenu.header,
          footer: submenu.footer,
          separatorBeforeKeys: submenu.separatorBeforeKeys,
        },
      };
    } else if (isElementOf(part, MenuItem)) {
      const {itemKey, ...rest} = part.props;
      item = {...rest, key: itemKey};
    }

    if (item) {
      if (separatorPending) {
        result.separatorBeforeKeys.add(item.key);
        separatorPending = false;
      }
      result.items.push(item);
    } else {
      throw new Error('Unsupported child in DropdownMenu composition');
    }
  }
  if (separatorPending) {
    throw new Error('MenuSectionSeparator must be placed between sections');
  }
  return result;
}

export function composeSelect<Value extends SelectKey>(
  children: React.ReactNode
): ComposedCollection<SelectOptionOrSection<Value>> {
  const result: ComposedCollection<SelectOptionOrSection<Value>> = {
    items: [],
    separatorBeforeKeys: new Set(),
  };
  let separatorPending = false;

  for (const part of elements(children)) {
    if (part.type === MenuHeader) {
      result.header = part;
      continue;
    }
    if (part.type === MenuFooter) {
      result.footer = part;
      continue;
    }
    if (part.type === MenuSectionSeparator) {
      const previous = result.items.at(-1);
      if (separatorPending || !previous || !('options' in previous)) {
        throw new Error('MenuSectionSeparator must be placed between sections');
      }
      separatorPending = true;
      continue;
    }

    if (separatorPending && part.type !== MenuSection) {
      throw new Error('MenuSectionSeparator must be placed between sections');
    }

    let item: SelectOptionOrSection<Value> | undefined;
    if (isElementOf(part, MenuSection)) {
      const {sectionKey, children: sectionChildren, ...rest} = part.props;
      const {label, items} = sectionContent(sectionChildren);
      if ((label === null || label === undefined) && !rest['aria-label']) {
        throw new Error('MenuSection requires MenuSectionLabel or aria-label');
      }
      item = {
        ...rest,
        key: sectionKey ?? `section-${result.items.length}`,
        label,
        options: items.map(child => {
          if (!isElementOf(child, ListItem<Value>)) {
            throw new Error('MenuSection in CompactSelect only accepts ListItem');
          }
          return child.props;
        }),
      };
    } else if (isElementOf(part, ListItem<Value>)) {
      item = part.props;
    }

    if (item) {
      if (separatorPending) {
        const key = 'options' in item ? item.key : item.value;
        result.separatorBeforeKeys.add(String(key));
        separatorPending = false;
      }
      result.items.push(item);
    } else {
      throw new Error('Unsupported child in CompactSelect composition');
    }
  }
  if (separatorPending) {
    throw new Error('MenuSectionSeparator must be placed between sections');
  }
  return result;
}

import {Fragment} from 'react';
import {Item} from '@react-stately/collections';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex} from '@sentry/scraps/layout';
import type {MenuListItemProps} from '@sentry/scraps/menuListItem';
import {Text} from '@sentry/scraps/text';

import type {CMDKFlatItem} from 'sentry/components/commandPalette/ui/commandPaletteActions';
import {isExternalLocation} from 'sentry/components/commandPalette/ui/locationUtils';
import {IconArrow, IconOpen} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

export type CommandPaletteActionMenuItem = MenuListItemProps & {
  children: CommandPaletteActionMenuItem[];
  key: string;
  hideCheck?: boolean;
};

export function renderActionItem(action: CMDKFlatItem, prefixMap: Map<string, string[]>) {
  const menuItem = makeMenuItemFromAction(action, prefixMap);
  const prefix = prefixMap.get(action.key);

  return (
    <Item<CommandPaletteActionMenuItem>
      {...menuItem}
      key={action.key}
      textValue={
        prefix?.length
          ? `${prefix.join(' ')} ${action.display.label}`
          : action.display.label
      }
    >
      {menuItem.label}
    </Item>
  );
}

export function renderSectionTitle(action: CMDKFlatItem) {
  return (
    <Text as="span" size="sm" variant="muted">
      {action.display.label}
      {action.display.details ? (
        <Text as="span" size="sm" variant="muted">
          <br />
          {action.display.details}
        </Text>
      ) : null}
    </Text>
  );
}

function makeMenuItemFromAction(
  action: CMDKFlatItem,
  prefixMap: Map<string, string[]>
): CommandPaletteActionMenuItem {
  const prefix = prefixMap.get(action.key);
  const isExternal = 'to' in action ? isExternalLocation(action.to) : false;
  const linkIndicator =
    'to' in action && isExternal ? (
      <Flex
        align="center"
        data-link-type="external"
        data-test-id="command-palette-link-indicator"
      >
        <IconDefaultsProvider size="xs" variant="muted">
          <IconOpen />
        </IconDefaultsProvider>
      </Flex>
    ) : undefined;
  const labelWithSuffix = action.display.labelSuffix ? (
    <Flex align="baseline" gap="xs" minWidth={0}>
      <Container minWidth={0} overflow="hidden">
        <Text as="div" ellipsis>
          {action.display.label}
        </Text>
      </Container>
      <Container flexShrink={0}>{action.display.labelSuffix}</Container>
    </Flex>
  ) : (
    action.display.label
  );
  const hasTrailingItem = Boolean(action.display.trailingItem);
  const trailingItems = hasTrailingItem ? undefined : linkIndicator;
  const label = hasTrailingItem ? (
    <Flex align="center" gap="md" width="100%" minWidth={0}>
      <Container flexShrink={0} maxWidth="100%" minWidth={0}>
        {labelWithSuffix}
      </Container>
      <Flex
        aria-hidden="true"
        align="center"
        flex={1}
        gap="md"
        justify="end"
        minWidth={0}
        overflow="hidden"
      >
        <Container maxWidth="100%" minWidth={0} overflow="hidden">
          {action.display.trailingItem}
        </Container>
        {linkIndicator}
      </Flex>
    </Flex>
  ) : (
    labelWithSuffix
  );
  const isMultiSelectAction =
    'onMultiSelect' in action && action.onMultiSelect !== undefined;

  return {
    key: action.key,
    label: prefix?.length ? (
      <Flex align="center" gap="xs">
        {prefix.map((segment, i) => (
          <Fragment key={i}>
            <Text variant="muted">{segment}</Text>
            <IconDefaultsProvider size="xs" variant="muted">
              <IconArrow direction="right" />
            </IconDefaultsProvider>
          </Fragment>
        ))}
        {label}
      </Flex>
    ) : (
      label
    ),
    details: action.display.details,
    leadingItems: isMultiSelectAction ? (
      <Flex height="100%" align="center" justify="center" width="16px">
        <Checkbox size="sm" checked={action.isSelected} readOnly />
      </Flex>
    ) : action.display.icon ? (
      <Flex
        height="100%"
        align="start"
        justify="center"
        width="14px"
        flexShrink={0}
        // This centers the icon vertically with the main text, regardless
        // of the icon details presence or not.
        paddingTop="2xs"
      >
        <IconDefaultsProvider size="sm">{action.display.icon}</IconDefaultsProvider>
      </Flex>
    ) : undefined,
    trailingItems,
    children: [],
    hideCheck: true,
  };
}

import {useMemo, useState} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Hotkey} from '@sentry/scraps/hotkey';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';

import {getKeyboardShortcutGroups} from './keyboardShortcuts';

export function KeyboardShortcutsDrawer() {
  const [query, setQuery] = useState('');
  const shortcutGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return getKeyboardShortcutGroups()
      .map(group => ({
        ...group,
        shortcuts: group.shortcuts.filter(shortcut =>
          `${group.label} ${shortcut.label}`.toLowerCase().includes(normalizedQuery)
        ),
      }))
      .filter(group => group.shortcuts.length > 0);
  }, [query]);

  return (
    <Stack height="100%">
      <DrawerHeader hideBar hideCloseButtonText>
        <Heading as="h2" size="md">
          {t('Keyboard Shortcuts')}
        </Heading>
      </DrawerHeader>
      <DrawerBody>
        <Stack gap="xl">
          <InputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch size="sm" />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              autoFocus
              aria-label={t('Search keyboard shortcuts')}
              placeholder={t('Search shortcuts')}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </InputGroup>

          {shortcutGroups.length > 0 ? (
            shortcutGroups.map(group => (
              <Stack key={group.label} gap="lg">
                <Heading as="h3" size="sm">
                  {group.label}
                </Heading>
                <Stack gap="md">
                  {group.shortcuts.map(shortcut => (
                    <Grid
                      key={shortcut.label}
                      columns="minmax(0, 1fr) auto"
                      align="center"
                      gap="md"
                    >
                      <Text variant="muted">{shortcut.label}</Text>
                      <Flex gap="xs" justify="end">
                        {shortcut.keybindings.map(keybinding => (
                          <Hotkey key={keybinding} value={keybinding} />
                        ))}
                      </Flex>
                    </Grid>
                  ))}
                </Stack>
              </Stack>
            ))
          ) : (
            <Text variant="muted">{t('No shortcuts found')}</Text>
          )}
        </Stack>
      </DrawerBody>
    </Stack>
  );
}

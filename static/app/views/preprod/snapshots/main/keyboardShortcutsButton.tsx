import {Fragment, type ReactNode} from 'react';
import {css} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Hotkey, Kbd} from '@sentry/scraps/hotkey';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openModal} from 'sentry/actionCreators/modal';
import {IconCommand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Shortcut {
  description: string;
  keys: ReactNode;
}

interface ShortcutGroup {
  shortcuts: Shortcut[];
  title: string;
}

function Keys({children}: {children: ReactNode}) {
  return (
    <Flex align="center" gap="xs">
      {children}
    </Flex>
  );
}

function getShortcutGroups(): ShortcutGroup[] {
  return [
    {
      title: t('Navigation'),
      shortcuts: [
        {keys: <Hotkey value="left" />, description: t('Switch to list view')},
        {keys: <Hotkey value="right" />, description: t('Switch to single image view')},
      ],
    },
    {
      title: t('List view'),
      shortcuts: [
        {
          keys: (
            <Keys>
              <Hotkey value="up" />
              <Hotkey value="down" />
            </Keys>
          ),
          description: t('Move selection up / down'),
        },
        {
          keys: (
            <Keys>
              <Hotkey value="command+up" />
              <Hotkey value="command+down" />
            </Keys>
          ),
          description: t('Select first / last snapshot'),
        },
        {keys: <Hotkey value="enter" />, description: t('Open selected snapshot')},
        {
          keys: <Hotkey value="space" />,
          description: t('Scroll selected snapshot into view'),
        },
      ],
    },
    {
      title: t('Single image view'),
      shortcuts: [
        {keys: <Hotkey value="up" />, description: t('Previous image')},
        {keys: <Hotkey value="down" />, description: t('Next image')},
        {
          keys: (
            <Keys>
              <Hotkey value="command+up" />
              <Hotkey value="command+down" />
            </Keys>
          ),
          description: t('First / last image'),
        },
      ],
    },
    {
      title: t('Zoom'),
      shortcuts: [
        {
          keys: (
            <Keys>
              <Hotkey value="command" />
              <Kbd>{t('Scroll')}</Kbd>
            </Keys>
          ),
          description: t('Zoom in list and split views'),
        },
        {keys: <Kbd>{t('Scroll')}</Kbd>, description: t('Zoom in single image view')},
        {keys: <Kbd>{t('Drag')}</Kbd>, description: t('Pan a zoomed image')},
      ],
    },
  ];
}

function KeyboardShortcutsList({
  columns,
}: {
  columns: React.ComponentProps<typeof Grid>['columns'];
}) {
  return (
    <Grid columns={columns} gap="xl">
      {getShortcutGroups().map(group => (
        <Stack key={group.title} gap="sm">
          <Text size="sm" bold>
            {group.title}
          </Text>
          {group.shortcuts.map(shortcut => (
            <Flex key={shortcut.description} justify="between" align="center" gap="lg">
              <Text size="sm">{shortcut.description}</Text>
              {shortcut.keys}
            </Flex>
          ))}
        </Stack>
      ))}
    </Grid>
  );
}

const modalCss = css`
  width: max-content;
  max-width: calc(100vw - 80px);
`;

function openKeyboardShortcutsModal() {
  openModal(
    ({Header, Body}) => (
      <Fragment>
        <Header closeButton>
          <Heading as="h3">{t('Keyboard shortcuts')}</Heading>
        </Header>
        <Body>
          <KeyboardShortcutsList columns={{zero: '1fr', sm: '1fr 1fr'}} />
        </Body>
      </Fragment>
    ),
    {modalCss}
  );
}

export function KeyboardShortcutsButton() {
  const organization = useOrganization();
  return (
    <Tooltip title={<KeyboardShortcutsList columns="1fr" />} maxWidth={360}>
      <Button
        size="xs"
        icon={<IconCommand />}
        aria-label={t('Keyboard shortcuts')}
        onClick={() => {
          trackAnalytics('preprod.snapshots.details.keyboard_shortcuts_opened', {
            organization,
          });
          openKeyboardShortcutsModal();
        }}
      />
    </Tooltip>
  );
}

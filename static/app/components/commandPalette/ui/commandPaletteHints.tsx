import type {ReactNode} from 'react';

import errorIllustration from 'sentry-images/spot/computer-missing.svg';

import {Hotkey} from '@sentry/scraps/hotkey';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {MORE_ACTIONS_SHORTCUT} from 'sentry/components/keyboardShortcuts/keyboardShortcuts';
import {t} from 'sentry/locale';

export function CommandPaletteHints({
  children,
  hasPanelActions,
}: {
  hasPanelActions: boolean;
  children?: ReactNode;
}) {
  return (
    <Stack borderTop="muted" padding="md xl">
      <Flex align="center" justify="between">
        <Flex align="center" gap="lg">
          <Flex align="center" gap="xs">
            <Flex align="center" gap="2xs">
              <Hotkey variant="debossed" value="up" />
              <Hotkey variant="debossed" value="down" />
            </Flex>
            <Text size="xs" variant="muted">
              {t('Move')}
            </Text>
          </Flex>
          <Flex align="center" gap="xs">
            <Hotkey variant="debossed" value="enter" />
            <Text size="xs" variant="muted">
              {t('Select')}
            </Text>
          </Flex>
          {children}
        </Flex>
        {hasPanelActions ? (
          <Flex align="center" gap="xs">
            <Hotkey variant="debossed" value={MORE_ACTIONS_SHORTCUT} />
            <Text size="xs" variant="muted">
              {t('More Actions')}
            </Text>
          </Flex>
        ) : null}
      </Flex>
    </Stack>
  );
}

export function CommandPaletteTextInputHints({children}: {children?: ReactNode}) {
  return (
    <Stack borderTop="muted" padding="md xl">
      <Flex align="center" gap="lg" width="100%">
        <Flex align="center" gap="xs" flexShrink={0}>
          <Hotkey variant="debossed" value="enter" />
          <Text size="xs" variant="muted">
            {t('Select')}
          </Text>
        </Flex>
        {children}
      </Flex>
    </Stack>
  );
}

export function CommandPaletteMultiSelectHint() {
  return (
    <Flex align="center" gap="xs">
      <Hotkey variant="debossed" value="shift+enter" />
      <Text size="xs" variant="muted">
        {t('Multi-Select')}
      </Text>
    </Flex>
  );
}

export function CommandPaletteReorderHint() {
  return (
    <Flex align="center" gap="xs">
      <Hotkey variant="debossed" value="shift+up" />
      <Hotkey variant="debossed" value="shift+down" />
      <Text size="xs" variant="muted">
        {t('Reorder')}
      </Text>
    </Flex>
  );
}

export function CommandPaletteNoResults() {
  return (
    <Stack
      align="center"
      justify="center"
      gap="md"
      padding="sm lg"
      flex={1}
      minHeight={0}
      overflow="hidden"
    >
      <Image src={errorIllustration} alt="No results" width="auto" height="120px" />
      <Stack align="center" gap="md">
        <Container padding="0 2xl">
          <Stack gap="sm">
            <Text size="md" align="center">
              {t("Whoops… we couldn't find any results matching your search.")}
            </Text>
            <Text size="md" align="center">
              {t('May we suggest rephrasing your query?')}
            </Text>
          </Stack>
        </Container>
        <Container>
          <FeedbackButton
            variant="primary"
            feedbackOptions={{
              tags: {
                'feedback.source': 'command_palette',
              },
            }}
          />
        </Container>
      </Stack>
    </Stack>
  );
}

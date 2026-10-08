import {Fragment, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconRefresh} from 'sentry/icons';
import {IconMarkdown} from 'sentry/icons/iconMarkdown';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';

interface ArtifactCardProps {
  children: ReactNode;
  icon: ReactNode;
  title: ReactNode;
  allowReset?: boolean;
  onCopy?: () => void;
  onReset?: () => void;
  /** `onReset` opens Seer Agent on the step rather than a re-run prompt. */
  resetInChat?: boolean;
  resetTooltip?: string;
}

export function ArtifactCard({
  children,
  icon,
  title,
  onCopy,
  allowReset,
  onReset,
  resetInChat,
  resetTooltip,
}: ArtifactCardProps) {
  const defaultResetTooltip = resetInChat
    ? t('Chat with Seer about this step, or provide more context for it to re-run')
    : t('Re-run step');

  return (
    <Container border="primary" radius="md" padding="lg" background="primary">
      <Disclosure defaultExpanded>
        <Disclosure.Title
          trailingItems={
            <Fragment>
              {allowReset && (
                <Tooltip title={resetTooltip ?? defaultResetTooltip}>
                  <Button
                    size="xs"
                    variant="transparent"
                    icon={
                      resetInChat ? <IconSeer size="xs" /> : <IconRefresh size="xs" />
                    }
                    aria-label={
                      resetInChat ? t('Chat with Seer about this step') : t('Re-run step')
                    }
                    onClick={onReset}
                    disabled={!onReset}
                  />
                </Tooltip>
              )}
              <Button
                size="xs"
                variant="transparent"
                icon={<IconMarkdown size="xs" />}
                aria-label={t('Copy as Markdown')}
                tooltipProps={{title: t('Copy as Markdown')}}
                onClick={onCopy}
                disabled={!onCopy}
              />
            </Fragment>
          }
        >
          <Flex gap="md" align="center">
            {icon}
            <Text bold>{title}</Text>
          </Flex>
        </Disclosure.Title>
        <Disclosure.Content>
          <Stack gap="lg">{children}</Stack>
        </Disclosure.Content>
      </Disclosure>
    </Container>
  );
}

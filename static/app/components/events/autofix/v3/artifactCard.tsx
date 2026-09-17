import {Fragment, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconRefresh} from 'sentry/icons';
import {IconCopy} from 'sentry/icons/iconCopy';
import {t} from 'sentry/locale';

interface ArtifactCardProps {
  children: ReactNode;
  icon: ReactNode;
  title: ReactNode;
  allowReset?: boolean;
  onCopy?: () => void;
  onReset?: () => void;
  resetTooltip?: string;
}

export function ArtifactCard({
  children,
  icon,
  title,
  onCopy,
  allowReset,
  onReset,
  resetTooltip,
}: ArtifactCardProps) {
  return (
    <Container border="primary" radius="md" padding="lg" background="primary">
      <Disclosure defaultExpanded>
        <Disclosure.Title
          trailingItems={
            <Fragment>
              {allowReset && (
                <Tooltip title={resetTooltip ?? t('Re-run step')}>
                  <Button
                    size="xs"
                    variant="transparent"
                    icon={<IconRefresh size="xs" />}
                    aria-label={t('Re-run step')}
                    onClick={onReset}
                    disabled={!onReset}
                  />
                </Tooltip>
              )}
              <Button
                size="xs"
                variant="transparent"
                icon={<IconCopy size="xs" />}
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

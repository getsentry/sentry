import {type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconCopy} from 'sentry/icons/iconCopy';
import {t} from 'sentry/locale';

interface ArtifactCardProps {
  children: ReactNode;
  icon: ReactNode;
  title: ReactNode;
  onCopy?: () => void;
}

export function ArtifactCard({children, icon, title, onCopy}: ArtifactCardProps) {
  return (
    <Container border="primary" radius="md" padding="lg" background="primary">
      <Disclosure defaultExpanded>
        <Disclosure.Title
          trailingItems={
            onCopy ? (
              <Button
                size="xs"
                priority="transparent"
                icon={<IconCopy size="xs" />}
                aria-label={t('Copy as Markdown')}
                tooltipProps={{title: t('Copy as Markdown')}}
                onClick={onCopy}
              />
            ) : null
          }
        >
          <Flex gap="md" align="center">
            {icon}
            <Text bold>{title}</Text>
          </Flex>
        </Disclosure.Title>
        <Disclosure.Content>
          <Flex direction="column" gap="lg">
            {children}
          </Flex>
        </Disclosure.Content>
      </Disclosure>
    </Container>
  );
}

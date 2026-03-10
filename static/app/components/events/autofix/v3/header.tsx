import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

interface SeerDrawerHeaderProps {
  event: Event;
  group: Group;
  project: Project;
  onCopyMarkdown?: () => void;
  onReset?: () => void;
}

export function SeerDrawerHeader({onCopyMarkdown, onReset}: SeerDrawerHeaderProps) {
  return (
    <DrawerHeader>
      <Flex justify="between" width="100%">
        <Flex align="center" gap="xs">
          <Text>{t('Autofix')}</Text>
          <Button
            size="xs"
            icon={<IconCopy />}
            onClick={onCopyMarkdown}
            disabled={!onCopyMarkdown}
            tooltipProps={{title: t('Copy analysis as Markdown')}}
            aria-label={t('Copy analysis as Markdown')}
            priority="transparent"
          />
          <Button
            size="xs"
            icon={<IconRefresh />}
            onClick={onReset}
            disabled={!onReset}
            tooltipProps={{title: t('Start a new analysis from scratch')}}
            aria-label={t('Start a new analysis from scratch')}
            priority="transparent"
          />
        </Flex>
        <AutofixFeedback iconOnly priority="transparent" />
      </Flex>
    </DrawerHeader>
  );
}

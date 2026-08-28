import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {CommandLine} from 'sentry/components/commandLine';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

type Props = {
  disabled: boolean;
  onRefresh: () => void;
};

export function WaitingActivity({onRefresh, disabled}: Props) {
  return (
    <Container background="primary" border="primary" radius="md" position="relative">
      <EmptyMessage
        title={t('Waiting on Activity!')}
        action={
          <Button icon={<IconRefresh />} onClick={onRefresh}>
            {t('Refresh')}
          </Button>
        }
      >
        {disabled
          ? undefined
          : tct('Run relay in your terminal with [commandLine]', {
              commandLine: <CommandLine>{'relay run'}</CommandLine>,
            })}
      </EmptyMessage>
    </Container>
  );
}

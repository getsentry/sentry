import {Button} from 'sentry/components/button';
import CommandLine from 'sentry/components/commandLine';
import EmptyMessage from 'sentry/components/emptyMessage';
import {Panel} from 'sentry/components/panels';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

type Props = {
  disabled: boolean;
  onRefresh: () => void;
};

const WaitingActivity = ({onRefresh, disabled}: Props) => (
  <Panel>
    <EmptyMessage
      title={t('Waiting on Activity!')}
      description={
        disabled
          ? undefined
          : tct('Run relay in your terminal with [commandLine]', {
              commandLine: <CommandLine>{'relay run'}</CommandLine>,
            })
      }
      action={
        <Button icon={<IconRefresh />} onClick={onRefresh}>
          {t('Refresh')}
        </Button>
      }
    />
  </Panel>
);

export default WaitingActivity;

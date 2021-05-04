import Button from 'app/components/button';
import CommandLine from 'app/components/commandLine';
import {Panel} from 'app/components/panels';
import {IconRefresh} from 'app/icons';
import {t, tct} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  onRefresh: () => void;
  disabled: boolean;
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

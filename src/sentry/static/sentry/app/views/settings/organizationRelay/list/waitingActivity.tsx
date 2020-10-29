import React from 'react';

import {t, tct} from 'app/locale';
import {Panel} from 'app/components/panels';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import CommandLine from 'app/components/commandLine';
import {IconRefresh} from 'app/icons';

type Props = {
  onRefresh: () => void;
};

const WaitingActivity = ({onRefresh}: Props) => (
  <Panel>
    <EmptyMessage
      title={t('Waiting on Activity!')}
      description={tct('Run relay in your terminal with [commandLine]', {
        commandLine: <CommandLine>{'relay run'}</CommandLine>,
      })}
      action={
        <Button icon={<IconRefresh />} onClick={onRefresh}>
          {t('Refresh')}
        </Button>
      }
    />
  </Panel>
);

export default WaitingActivity;

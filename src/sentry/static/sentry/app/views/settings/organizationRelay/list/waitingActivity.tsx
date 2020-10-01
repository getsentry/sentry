import React from 'react';

import {t, tct} from 'app/locale';
import {Panel} from 'app/components/panels';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconRefresh} from 'app/icons';

import Code from './code';

type Props = {
  onRefresh: () => void;
};

const WaitingActivity = ({onRefresh}: Props) => (
  <Panel>
    <EmptyMessage
      title={t('Waiting on Activity!')}
      description={tct('Run relay in your terminal with [command]', {
        command: <Code text="relay run" />,
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

import React from 'react';

import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconCommit} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  orgId: string;
};

const NoRepoConnected = ({orgId}: Props) => (
  <EmptyMessage
    icon={<IconCommit size="xl" />}
    title={t('Releases are better with commit data!')}
    description={t(
      'Connect a repository to see commit info, files changed, and authors involved in future releases.'
    )}
    action={
      <Button priority="primary" to={`/settings/${orgId}/repos/`}>
        {t('Connect a repository')}
      </Button>
    }
  />
);

export default NoRepoConnected;

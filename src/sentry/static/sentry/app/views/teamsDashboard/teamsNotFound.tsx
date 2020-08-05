import React from 'react';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {IconAdd, IconFile} from 'app/icons';

type Props = {
  hasTeamAdminAccess: boolean;
  onCreateTeam: () => void;
};

const TeamsNotFound = ({hasTeamAdminAccess, onCreateTeam}: Props) => (
  <EmptyMessage
    size="large"
    title={t('No teams have been created yet.')}
    icon={<IconFile size="xl" />}
    action={
      <Button
        size="small"
        disabled={!hasTeamAdminAccess}
        title={
          !hasTeamAdminAccess
            ? t('You do not have permission to create teams')
            : undefined
        }
        onClick={onCreateTeam}
        icon={<IconAdd size="xs" isCircled />}
      >
        {t('Create Team')}
      </Button>
    }
  />
);

export default TeamsNotFound;

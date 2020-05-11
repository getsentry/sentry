import React from 'react';

import {IconClickup, IconClubhouse, IconRookout, IconGeneric} from 'app/icons';

type Props = {
  slug: string;
};

const SentryAppIcon = ({slug}: Props) => {
  switch (slug) {
    case 'clickup':
      return <IconClickup size="md" />;
    case 'clubhouse':
      return <IconClubhouse size="md" />;
    case 'rookout':
      return <IconRookout size="md" />;
    default:
      return <IconGeneric size="md" />;
  }
};

export {SentryAppIcon};

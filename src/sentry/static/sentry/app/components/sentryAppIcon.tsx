import {SentryAppComponent} from 'app/types';
import {
  IconClickup,
  IconClubhouse,
  IconRookout,
  IconTeamwork,
  IconLinear,
  IconGeneric,
} from 'app/icons';

type Props = {
  slug: SentryAppComponent['sentryApp']['slug'];
};

const SentryAppIcon = ({slug}: Props) => {
  switch (slug) {
    case 'clickup':
      return <IconClickup size="md" />;
    case 'clubhouse':
      return <IconClubhouse size="md" />;
    case 'rookout':
      return <IconRookout size="md" />;
    case 'teamwork':
      return <IconTeamwork size="md" />;
    case 'linear':
      return <IconLinear size="md" />;
    default:
      return <IconGeneric size="md" />;
  }
};

export {SentryAppIcon};

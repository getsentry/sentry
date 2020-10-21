import {t} from 'app/locale';

import ReleaseListDropdown from './releaseListDropdown';

type Props = {
  selected: string;
  onSelect: (key: string) => void;
};

const ReleaseListSortOptions = ({selected, onSelect}: Props) => {
  const options = [
    {
      key: 'date',
      label: t('Date Created'),
    },
    {
      key: 'sessions',
      label: t('Total Sessions'),
    },
    {
      key: 'users_24h',
      label: t('Active Users'),
    },
    {
      key: 'crash_free_users',
      label: t('Crash Free Users'),
    },
    {
      key: 'crash_free_sessions',
      label: t('Crash Free Sessions'),
    },
  ];

  return (
    <ReleaseListDropdown
      label={t('Sort by')}
      options={options}
      selected={selected}
      onSelect={onSelect}
    />
  );
};

export default ReleaseListSortOptions;

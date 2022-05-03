import {t} from 'sentry/locale';

import ReleasesDropdown from './releasesDropdown';

export enum ReleasesDisplayOption {
  USERS = 'users',
  SESSIONS = 'sessions',
}

const displayOptions = {
  [ReleasesDisplayOption.SESSIONS]: {label: t('Sessions')},
  [ReleasesDisplayOption.USERS]: {label: t('Users')},
};

type Props = {
  onSelect: (key: string) => void;
  selected: ReleasesDisplayOption;
};

function ReleasesDisplayOptions({selected, onSelect}: Props) {
  return (
    <ReleasesDropdown
      label={t('Display')}
      options={displayOptions}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export default ReleasesDisplayOptions;

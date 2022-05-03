import {t} from 'sentry/locale';

import ReleasesDropdown from './releasesDropdown';

export enum ReleasesStatusOption {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

const options = {
  [ReleasesStatusOption.ACTIVE]: {label: t('Active')},
  [ReleasesStatusOption.ARCHIVED]: {label: t('Archived')},
};

type Props = {
  onSelect: (key: string) => void;
  selected: ReleasesStatusOption;
};

function ReleasesStatusOptions({selected, onSelect}: Props) {
  return (
    <ReleasesDropdown
      label={t('Status')}
      options={options}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export default ReleasesStatusOptions;

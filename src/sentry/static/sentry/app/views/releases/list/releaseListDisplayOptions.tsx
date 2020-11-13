import React from 'react';

import {t} from 'app/locale';

import ReleaseListDropdown from './releaseListDropdown';

const options = [
  {
    key: 'active',
    label: t('Active'),
  },
  {
    key: 'archived',
    label: t('Archived'),
  },
];

type Props = {
  selected: string;
  onSelect: (key: string) => void;
};

function ReleaseListDisplayOptions({selected, onSelect}: Props) {
  return (
    <ReleaseListDropdown
      label={t('Display')}
      options={options}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export default ReleaseListDisplayOptions;

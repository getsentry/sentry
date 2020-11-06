import React from 'react';

import {t} from 'app/locale';

import ReleaseListDropdown from './releaseListDropdown';

type Props = {
  selected: string;
  onSelect: (key: string) => void;
};

const ReleaseListDisplayOptions = ({selected, onSelect}: Props) => {
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

  return (
    <ReleaseListDropdown
      label={t('Display')}
      options={options}
      selected={selected}
      onSelect={onSelect}
    />
  );
};

export default ReleaseListDisplayOptions;

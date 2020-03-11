import React from 'react';

import {t} from 'app/locale';

import ReleaseListDropdown from './releaseListDropdown';

type Props = {
  selected: string;
  onSelect: (key: string) => void;
};

const ReleaseListPeriod = ({selected, onSelect}: Props) => {
  const options = [
    {
      key: '24h',
      label: t('Last 24 hours'),
    },
    {
      key: '48h',
      label: t('Last 48 hours'),
    },
    {
      key: '7d',
      label: t('Last 7 days'),
    },
    {
      key: '14d',
      label: t('Last 14 days'),
    },
  ];

  return (
    <ReleaseListDropdown
      label={t('Period')}
      options={options}
      selected={selected}
      onSelect={onSelect}
    />
  );
};

export default ReleaseListPeriod;

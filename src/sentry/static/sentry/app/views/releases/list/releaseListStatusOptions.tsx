import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';

import ReleaseListDropdown from './releaseListDropdown';
import {StatusOption} from './utils';

const options = {
  [StatusOption.ACTIVE]: t('Active'),
  [StatusOption.ARCHIVED]: t('Archived'),
};

type Props = {
  selected: StatusOption;
  onSelect: (key: string) => void;
};

function ReleaseListStatusOptions({selected, onSelect}: Props) {
  return (
    <StyledReleaseListDropdown
      label={t('Status')}
      options={options}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export default ReleaseListStatusOptions;

const StyledReleaseListDropdown = styled(ReleaseListDropdown)`
  z-index: 3;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    order: 1;
  }
`;

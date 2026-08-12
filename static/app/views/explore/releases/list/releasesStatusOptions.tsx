import styled from '@emotion/styled';

import {t} from 'sentry/locale';

import {ReleasesDropdown} from './releasesDropdown';

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

export function ReleasesStatusOptions({selected, onSelect}: Props) {
  return (
    <StyledReleasesDropdown
      label={t('Status')}
      options={options}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

const StyledReleasesDropdown = styled(ReleasesDropdown)`
  z-index: 3;
  @container (max-width: ${p => p.theme.container['4xl']}) {
    order: 1;
  }
`;

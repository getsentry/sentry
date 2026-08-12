import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

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
    <DropdownContainer order={{zero: 1, '4xl': 0}}>
      <ReleasesDropdown
        label={t('Status')}
        options={options}
        selected={selected}
        onSelect={onSelect}
      />
    </DropdownContainer>
  );
}

const DropdownContainer = styled(Container)`
  z-index: 3;
`;

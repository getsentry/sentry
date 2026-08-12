import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

import {ReleasesDropdown} from './releasesDropdown';

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

export function ReleasesDisplayOptions({selected, onSelect}: Props) {
  return (
    <DropdownContainer order={{zero: 3, '4xl': 0}}>
      <ReleasesDropdown
        label={t('Display')}
        options={displayOptions}
        selected={selected}
        onSelect={onSelect}
      />
    </DropdownContainer>
  );
}

const DropdownContainer = styled(Container)`
  z-index: 1;
`;

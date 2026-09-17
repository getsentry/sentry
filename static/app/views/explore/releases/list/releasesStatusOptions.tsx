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
    <Container width={{zero: '100%', '2xl': 'max-content'}}>
      {containerProps => (
        <ReleasesDropdown
          {...containerProps}
          label={t('Status')}
          options={options}
          selected={selected}
          onSelect={onSelect}
          style={{zIndex: 3}}
        />
      )}
    </Container>
  );
}

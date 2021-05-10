import styled from '@emotion/styled';

import {t} from 'app/locale';

import ReleaseListDropdown from './releaseListDropdown';
import {DisplayOption} from './utils';

const displayOptions = {
  [DisplayOption.SESSIONS]: t('Sessions'),
  [DisplayOption.USERS]: t('Users'),
};

type Props = {
  selected: DisplayOption;
  onSelect: (key: string) => void;
};

function ReleaseListDisplayOptions({selected, onSelect}: Props) {
  return (
    <StyledReleaseListDropdown
      label={t('Display')}
      options={displayOptions}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export default ReleaseListDisplayOptions;

const StyledReleaseListDropdown = styled(ReleaseListDropdown)`
  z-index: 1;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    order: 3;
  }
`;

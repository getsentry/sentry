import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import {SelectValue} from 'app/types';

export enum SortOption {
  RECENT_FIRST = 'recent-first',
  RECENT_LAST = 'recent-last',
}

const SORT_OPTIONS: SelectValue<string>[] = [
  {label: t('Recent first'), value: SortOption.RECENT_FIRST},
  {label: t('Recent last'), value: SortOption.RECENT_LAST},
];

type Props = {
  activeSortOption: SortOption;
  onChange: (sortOption: SortOption) => void;
};

function SortOptions({activeSortOption, onChange}: Props) {
  const {label: currentLabel, value: currentValue} =
    SORT_OPTIONS.find(sortOption => sortOption.value === activeSortOption) ??
    SORT_OPTIONS[0];

  return (
    <Wrapper buttonProps={{prefix: t('Sort By'), size: 'small'}} label={currentLabel}>
      {SORT_OPTIONS.map(({label, value}) => (
        <DropdownItem
          key={value}
          eventKey={value}
          isActive={value === currentValue}
          onSelect={(sortOption: SortOption) => onChange(sortOption)}
        >
          {label}
        </DropdownItem>
      ))}
    </Wrapper>
  );
}

export default SortOptions;

const Wrapper = styled(DropdownControl)`
  z-index: 2;
  &,
  button {
    width: 100%;
  }
  grid-column: 1/-1;
  grid-row: 2/3;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: 1/2;
    grid-row: 2/2;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-column: auto;
    grid-row: auto;
  }
`;

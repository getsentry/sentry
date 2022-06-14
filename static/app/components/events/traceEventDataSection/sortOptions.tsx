import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {t} from 'sentry/locale';
import {SelectValue} from 'sentry/types';

export enum SortOption {
  RECENT_FIRST = 'recent-first',
  RECENT_LAST = 'recent-last',
}

const SORT_OPTIONS: SelectValue<string>[] = [
  {
    label: t('Recent first'),
    value: SortOption.RECENT_FIRST,
  },
  {
    label: t('Recent last'),
    value: SortOption.RECENT_LAST,
  },
];

type Props = {
  activeSortOption: SortOption;
  disabled: boolean;
  onChange: (sortOption: SortOption) => void;
};

function SortOptions({activeSortOption, onChange, disabled}: Props) {
  const {label: currentLabel, value: currentValue} =
    SORT_OPTIONS.find(sortOption => sortOption.value === activeSortOption) ??
    SORT_OPTIONS[0];

  return (
    <Wrapper
      buttonProps={{
        prefix: t('Sort By'),
        size: 'small',
        disabled,
        title: disabled ? t('Stack trace contains only 1 frame') : undefined,
      }}
      label={currentLabel}
    >
      {SORT_OPTIONS.map(({label, value}) => (
        <DropdownItem
          key={value}
          eventKey={value}
          isActive={value === currentValue}
          onSelect={(sortOption: SortOption) => onChange(sortOption)}
          aria-label={t('Sort option')}
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

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 1/-1;
  }
`;

import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/selectControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';

import {SortAscOrDescOption, sortAscOrDescOptions} from './utils';

interface Values {
  sortAscOrDesc: SortAscOrDescOption;
  sortBy: string;
}

interface Props {
  onChange: (values: Values) => void;
  sortByOptions: SelectValue<string>[];
  values: Values;
}

export function SortBySelectors({values, sortByOptions, onChange}: Props) {
  return (
    <Wrapper>
      <SelectControl
        name="sortAscOrDesc"
        menuPlacement="auto"
        options={Object.keys(sortAscOrDescOptions).map(value => ({
          label: sortAscOrDescOptions[value],
          value,
        }))}
        value={values.sortAscOrDesc}
        onChange={(option: SelectValue<SortAscOrDescOption>) => {
          onChange({sortBy: values.sortBy, sortAscOrDesc: option.value});
        }}
      />
      <SelectControl
        name="sortBy"
        menuPlacement="auto"
        placeholder={`${t('Select a column')}\u{2026}`}
        value={values.sortBy}
        options={sortByOptions}
        onChange={(option: SelectValue<string>) => {
          onChange({sortBy: option.value, sortAscOrDesc: values.sortAscOrDesc});
        }}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 200px 1fr;
  }
`;

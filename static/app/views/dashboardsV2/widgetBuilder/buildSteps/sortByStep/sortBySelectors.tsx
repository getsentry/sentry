import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/selectControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';

import {SortDirection, sortDirections} from '../../utils';

interface Values {
  sortBy: string;
  sortDirection: SortDirection;
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
        name="sortDirection"
        menuPlacement="auto"
        options={Object.keys(sortDirections).map(value => ({
          label: sortDirections[value],
          value,
        }))}
        value={values.sortDirection}
        onChange={(option: SelectValue<SortDirection>) => {
          onChange({sortBy: values.sortBy, sortDirection: option.value});
        }}
      />
      <SelectControl
        name="sortBy"
        menuPlacement="auto"
        placeholder={`${t('Select a column')}\u{2026}`}
        value={values.sortBy}
        options={sortByOptions}
        onChange={(option: SelectValue<string>) => {
          onChange({sortBy: option.value, sortDirection: values.sortDirection});
        }}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 200px 1fr;
  }
`;

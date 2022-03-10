import {Fragment} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import SelectControl from 'sentry/components/forms/selectControl';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';

import {RESULTS_LIMIT, SortDirection, sortDirections} from './utils';

interface Values {
  sortBy: string;
  sortDirection: SortDirection;
  resultsLimit?: number;
}

interface Props {
  onChange: (values: Values) => void;
  sortByOptions: SelectValue<string>[];
  values: Values;
}

export function SortBySelectors({values, sortByOptions, onChange}: Props) {
  return (
    <Fragment>
      {values.resultsLimit !== undefined && (
        <ResultsLimitSelector
          name="resultsLimit"
          menuPlacement="auto"
          options={[...Array(RESULTS_LIMIT).keys()].map(limit => {
            const value = limit + 1;
            return {
              label: tn('Limit to %s result', 'Limit to %s results', value),
              value,
            };
          })}
          value={values.resultsLimit}
          onChange={(option: SelectValue<number>) => {
            onChange({
              sortBy: values.sortBy,
              sortDirection: values.sortDirection,
              resultsLimit: option.value,
            });
          }}
        />
      )}
      <SortBySelectorsWrapper>
        <SelectControl
          name="sortDirection"
          menuPlacement="auto"
          options={Object.keys(sortDirections).map(value => ({
            label: sortDirections[value],
            value,
          }))}
          value={values.sortDirection}
          onChange={(option: SelectValue<SortDirection>) => {
            onChange({
              sortBy: values.sortBy,
              resultsLimit: values.resultsLimit,
              sortDirection: option.value,
            });
          }}
        />
        <SelectControl
          name="sortBy"
          menuPlacement="auto"
          placeholder={`${t('Select a column')}\u{2026}`}
          value={values.sortBy}
          options={uniqBy(sortByOptions, ({value}) => value)}
          onChange={(option: SelectValue<string>) => {
            onChange({
              sortBy: option.value,
              resultsLimit: values.resultsLimit,
              sortDirection: values.sortDirection,
            });
          }}
        />
      </SortBySelectorsWrapper>
    </Fragment>
  );
}

const SortBySelectorsWrapper = styled('div')`
  display: grid;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 200px 1fr;
  }
`;

const ResultsLimitSelector = styled(SelectControl)`
  margin-bottom: ${space(1)};
`;

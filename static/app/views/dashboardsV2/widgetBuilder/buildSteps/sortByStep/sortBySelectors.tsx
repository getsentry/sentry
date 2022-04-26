import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import SelectControl from 'sentry/components/forms/selectControl';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';
import {WidgetType} from 'sentry/views/dashboardsV2/types';

import {SortDirection, sortDirections} from '../../utils';

interface Values {
  sortBy: string;
  sortDirection: SortDirection;
}

interface Props {
  onChange: (values: Values) => void;
  sortByOptions: SelectValue<string>[];
  values: Values;
  widgetType: WidgetType;
  disabledReason?: string;
  disabledSort?: boolean;
  disabledSortDirection?: boolean;
}

export function SortBySelectors({
  values,
  sortByOptions,
  onChange,
  disabledReason,
  disabledSort,
  disabledSortDirection,
}: Props) {
  return (
    <Tooltip title={disabledReason} disabled={!(disabledSortDirection && disabledSort)}>
      <Wrapper>
        <Tooltip
          title={disabledReason}
          disabled={!disabledSortDirection || (disabledSortDirection && disabledSort)}
        >
          <SelectControl
            name="sortDirection"
            aria-label="Sort direction"
            menuPlacement="auto"
            disabled={disabledSortDirection}
            options={Object.keys(sortDirections).map(value => ({
              label: sortDirections[value],
              value,
            }))}
            value={values.sortDirection}
            onChange={(option: SelectValue<SortDirection>) => {
              onChange({
                sortBy: values.sortBy,
                sortDirection: option.value,
              });
            }}
          />
        </Tooltip>
        <Tooltip
          title={disabledReason}
          disabled={!disabledSort || (disabledSortDirection && disabledSort)}
        >
          <SelectControl
            name="sortBy"
            aria-label="Sort by"
            menuPlacement="auto"
            disabled={disabledSort}
            placeholder={`${t('Select a column')}\u{2026}`}
            value={values.sortBy}
            options={uniqBy(sortByOptions, ({value}) => value)}
            onChange={(option: SelectValue<string>) => {
              onChange({
                sortBy: option.value,
                sortDirection: values.sortDirection,
              });
            }}
          />
        </Tooltip>
      </Wrapper>
    </Tooltip>
  );
}

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 200px 1fr;
  }
`;

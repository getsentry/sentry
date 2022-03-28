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
}

export function SortBySelectors({values, sortByOptions, widgetType, onChange}: Props) {
  return (
    <Wrapper>
      <Tooltip
        title={
          widgetType === WidgetType.ISSUE
            ? t('Issues dataset does not yet support descending order')
            : undefined
        }
        disabled={widgetType !== WidgetType.ISSUE}
      >
        <SelectControl
          name="sortDirection"
          menuPlacement="auto"
          disabled={widgetType === WidgetType.ISSUE}
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
      <SelectControl
        name="sortBy"
        menuPlacement="auto"
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

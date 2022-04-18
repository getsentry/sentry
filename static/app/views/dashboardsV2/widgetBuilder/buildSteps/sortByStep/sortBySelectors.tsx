import {useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import Input from 'sentry/components/forms/controls/input';
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
  const [customEquation, setCustomEquation] = useState<Values | null>(null);
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
        value={customEquation ? 'custom-equation' : values.sortBy}
        options={[
          ...uniqBy(sortByOptions, ({value}) => value),
          {value: 'custom-equation', label: t('Custom Equation')},
        ]}
        onChange={(option: SelectValue<string>) => {
          if (option.value === 'custom-equation') {
            setCustomEquation({
              sortBy: '',
              sortDirection: values.sortDirection,
            });
            return;
          }

          onChange({
            sortBy: option.value,
            sortDirection: values.sortDirection,
          });
          setCustomEquation(null);
        }}
      />
      {customEquation && (
        <StyledInput
          placeholder={t('Enter Equation')}
          onChange={e => {
            setCustomEquation({
              sortBy: `equation|${e.target.value}`,
              sortDirection: values.sortDirection,
            });
          }}
          onBlur={() => {
            onChange(customEquation);
          }}
        />
      )}
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

const StyledInput = styled(Input)`
  grid-column: 1/-1;
`;

import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import trimStart from 'lodash/trimStart';

import SelectControl from 'sentry/components/forms/selectControl';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SelectValue, TagCollection} from 'sentry/types';
import {
  EQUATION_PREFIX,
  explodeField,
  generateFieldAsString,
  getEquation,
  isEquation,
} from 'sentry/utils/discover/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import useOrganization from 'sentry/utils/useOrganization';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import ArithmeticInput from 'sentry/views/eventsV2/table/arithmeticInput';
import {QueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import {getAmendedFieldOptions, SortDirection, sortDirections} from '../../utils';

const CUSTOM_EQUATION_VALUE = 'custom-equation';

interface Values {
  sortBy: string;
  sortDirection: SortDirection;
}

interface Props {
  displayType: DisplayType;
  // TODO: type
  filterPrimaryOptions: any;
  onChange: (values: Values) => void;
  sortByOptions: SelectValue<string>[];
  tags: TagCollection;
  values: Values;
  widgetType: WidgetType;
  disabledReason?: string;
  disabledSort?: boolean;
  disabledSortDirection?: boolean;
  hasGroupBy?: boolean;
}

export function SortBySelectors({
  values,
  sortByOptions,
  widgetType,
  onChange,
  disabledReason,
  disabledSort,
  disabledSortDirection,
  hasGroupBy,
  tags,
  filterPrimaryOptions,
}: Props) {
  const organization = useOrganization();
  const [showCustomEquation, setShowCustomEquation] = useState(false);
  const [customEquation, setCustomEquation] = useState<Values>({
    sortBy: `${EQUATION_PREFIX}`,
    sortDirection: values.sortDirection,
  });
  useEffect(() => {
    const isSortingByEquation = isEquation(trimStart(values.sortBy, '-'));
    if (isSortingByEquation) {
      setCustomEquation({
        sortBy: trimStart(values.sortBy, '-'),
        sortDirection: values.sortDirection,
      });
    }
    setShowCustomEquation(isSortingByEquation);
  }, [values.sortBy]);

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
          <Measurements>
            {({measurements}) => (
              <QueryField
                fieldValue={
                  showCustomEquation
                    ? explodeField({field: CUSTOM_EQUATION_VALUE})
                    : explodeField({field: values.sortBy})
                }
                fieldOptions={{
                  ...(hasGroupBy
                    ? {
                        'field:custom-equation': {
                          label: 'Custom Equation',
                          value: {
                            kind: FieldValueKind.FIELD,
                            meta: {name: 'custom-equation', dataType: 'string'},
                          },
                        },
                      }
                    : {}),

                  ...getAmendedFieldOptions({measurements, organization, tags}),
                }}
                onChange={value => {
                  const parsedValue = generateFieldAsString(value);
                  const isSortingByCustomEquation = parsedValue === CUSTOM_EQUATION_VALUE;
                  setShowCustomEquation(isSortingByCustomEquation);
                  if (isSortingByCustomEquation) {
                    onChange(customEquation);
                    return;
                  }

                  onChange({
                    sortBy: parsedValue,
                    sortDirection: values.sortDirection,
                  });
                }}
                filterPrimaryOptions={filterPrimaryOptions}
                // filterPrimaryOptions={option =>
                //   filterPrimaryOptions({
                //     option,
                //     widgetType,
                //     displayType,
                //   })
                // }
                // filterAggregateParameters={filterAggregateParameters(fieldValue)}
                // otherColumns={aggregates}
                // noFieldsMessage={noFieldsMessage}
              />
            )}
          </Measurements>
        </Tooltip>
        {showCustomEquation && (
          <ArithmeticInputWrapper>
            <ArithmeticInput
              name="arithmetic"
              type="text"
              required
              placeholder={t('Enter Equation')}
              value={getEquation(customEquation.sortBy)}
              onUpdate={value => {
                const newValue = {
                  sortBy: `${EQUATION_PREFIX}${value}`,
                  sortDirection: values.sortDirection,
                };
                onChange(newValue);
                setCustomEquation(newValue);
              }}
              hideFieldOptions
            />
          </ArithmeticInputWrapper>
        )}
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

const ArithmeticInputWrapper = styled('div')`
  grid-column: 1/-1;
`;

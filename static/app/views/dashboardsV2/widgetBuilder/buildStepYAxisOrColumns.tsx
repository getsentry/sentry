import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, TagCollection} from 'sentry/types';
import {
  explodeField,
  generateFieldAsString,
  getAggregateAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'sentry/utils/performance/spanOperationBreakdowns/constants';
import ColumnEditCollection from 'sentry/views/eventsV2/table/columnEditCollection';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import Field from 'sentry/views/settings/components/forms/field';

import {WidgetQuery, WidgetType} from '../types';

import BuildStep from './buildStep';
import {DataSet, DisplayType} from './utils';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  onChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  organization: Organization;
  queries: WidgetQuery[];
  tags: TagCollection;
  widgetType: WidgetType;
  errors?: Record<string, string>[];
}

export function BuildStepYAxisOrColumns({
  dataSet,
  displayType,
  organization,
  queries,
  tags,
  errors,
  widgetType,
  onChange,
}: Props) {
  function handleChange(fields: QueryFieldValue[]) {
    const fieldStrings = fields.map(generateFieldAsString);
    const aggregateAliasFieldStrings = fieldStrings.map(getAggregateAlias);

    for (const index in queries) {
      const queryIndex = Number(index);
      const query = queries[queryIndex];
      const descending = query.orderby.startsWith('-');
      const orderbyAggregateAliasField = query.orderby.replace('-', '');
      const prevAggregateAliasFieldStrings = query.fields.map(getAggregateAlias);
      const newQuery = cloneDeep(query);

      newQuery.fields = fieldStrings;

      if (!aggregateAliasFieldStrings.includes(orderbyAggregateAliasField)) {
        newQuery.orderby = '';

        if (prevAggregateAliasFieldStrings.length === fields.length) {
          // The Field that was used in orderby has changed. Get the new field.
          newQuery.orderby = `${descending && '-'}${
            aggregateAliasFieldStrings[
              prevAggregateAliasFieldStrings.indexOf(orderbyAggregateAliasField)
            ]
          }`;
        }
      }

      onChange(queryIndex, newQuery);
    }
  }

  if ([DisplayType.TABLE, DisplayType.TOP_N].includes(displayType)) {
    return (
      <BuildStep title={t('Columns')} description="Description of what this means">
        {dataSet === DataSet.EVENTS ? (
          <Measurements>
            {({measurements}) => {
              const explodedFields = queries[0].fields.map(field =>
                explodeField({field})
              );

              const amendedFieldOptions = generateFieldOptions({
                organization,
                tagKeys: Object.values(tags).map(({key}) => key),
                measurementKeys: Object.values(measurements).map(({key}) => key),
                spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
              });

              return (
                <ColumnCollectionField
                  inline={false}
                  error={errors?.find(error => error?.fields)?.fields}
                  flexibleControlStateSize
                  stacked
                  required
                >
                  <ColumnCollectionEdit
                    columns={explodedFields}
                    onChange={handleChange}
                    fieldOptions={amendedFieldOptions}
                    organization={organization}
                    source={widgetType}
                  />
                </ColumnCollectionField>
              );
            }}
          </Measurements>
        ) : (
          'WIP'
        )}
      </BuildStep>
    );
  }

  return (
    <BuildStep
      title={t('Choose your y-axis')}
      description="Description of what this means"
    >
      WIP
    </BuildStep>
  );
}

const ColumnCollectionEdit = styled(ColumnEditCollection)`
  margin-top: ${space(1)};
`;

const ColumnCollectionField = styled(Field)`
  padding: ${space(1)} 0;
`;

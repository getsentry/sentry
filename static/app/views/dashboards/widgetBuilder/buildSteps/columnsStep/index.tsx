import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboards/types';
import {appendFieldIfUnknown} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import {DataSet, getFieldOptionFormat} from '../../utils';
import {BuildStep} from '../buildStep';

import {ColumnFields} from './columnFields';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  explodedFields: QueryFieldValue[];
  handleColumnFieldChange: (newFields: QueryFieldValue[]) => void;
  isOnDemandWidget: boolean;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  organization: Organization;
  tags: TagCollection;
  widgetType: WidgetType;
  queryErrors?: Record<string, any>[];
}

export function ColumnsStep({
  dataSet,
  displayType,
  organization,
  widgetType,
  handleColumnFieldChange,
  queryErrors,
  explodedFields,
  tags,
  isOnDemandWidget,
}: Props) {
  const {customMeasurements} = useCustomMeasurements();
  const datasetConfig = getDatasetConfig(widgetType);

  let fieldOptions = datasetConfig.getTableFieldOptions(
    organization,
    tags,
    customMeasurements
  );

  // We need to persist the form values across Errors and Transactions datasets
  // for the discover dataset split, so functions that are not compatible with
  // errors should still appear in the field options to gracefully handle incorrect
  // dataset splitting.
  if ([DataSet.ERRORS, DataSet.TRANSACTIONS].includes(dataSet)) {
    explodedFields.forEach(field => {
      // Inject functions that aren't compatible with the current dataset
      if (field.kind === 'function') {
        const functionName = field.alias || field.function[0];
        if (!(`function:${functionName}` in fieldOptions)) {
          const formattedField = getFieldOptionFormat(field);
          if (formattedField) {
            const [key, value] = formattedField;
            fieldOptions[key] = value;

            // If the function needs to be injected, inject the parameter as a tag
            // as well if it isn't already an option
            if (
              field.function[1] &&
              !fieldOptions[`field:${field.function[1]}`] &&
              !fieldOptions[`tag:${field.function[1]}`]
            ) {
              fieldOptions = appendFieldIfUnknown(fieldOptions, {
                kind: FieldValueKind.TAG,
                meta: {
                  dataType: 'string',
                  name: field.function[1],
                  unknown: true,
                },
              });
            }
          }
        }
      }
    });
  }

  return (
    <BuildStep
      data-test-id="choose-column-step"
      title={t('Choose your columns')}
      description={
        dataSet === DataSet.ISSUES
          ? tct(
              '[fieldTagLink: Field and tag] columns will help you view more details about the issues (e.g., title).',
              {
                fieldTagLink: (
                  <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#event-properties" />
                ),
              }
            )
          : dataSet === DataSet.RELEASES
            ? tct(
                'To stack sessions, add [functionLink: functions] f(x) that may take in additional parameters. [fieldTagLink: Field and tag] columns will help you view more details about the sessions (e.g., releases).',
                {
                  functionLink: (
                    <ExternalLink href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns" />
                  ),
                  fieldTagLink: (
                    <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#release-properties" />
                  ),
                }
              )
            : tct(
                'To stack events, add [functionLink: functions] f(x) that may take in additional parameters. [fieldTagLink: Field and tag] columns will help you view more details about the events (e.g., title).',
                {
                  functionLink: (
                    <ExternalLink href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns" />
                  ),
                  fieldTagLink: (
                    <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#event-properties" />
                  ),
                }
              )
      }
    >
      <ColumnFields
        displayType={displayType}
        organization={organization}
        widgetType={widgetType}
        fields={explodedFields}
        errors={queryErrors}
        fieldOptions={fieldOptions}
        isOnDemandWidget={isOnDemandWidget}
        filterAggregateParameters={datasetConfig.filterAggregateParams}
        filterPrimaryOptions={datasetConfig.filterTableOptions}
        onChange={handleColumnFieldChange}
      />
    </BuildStep>
  );
}

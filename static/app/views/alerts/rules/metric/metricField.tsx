import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {FormFieldProps} from 'sentry/components/forms/formField';
import FormField from 'sentry/components/forms/formField';
import type {Organization} from 'sentry/types/organization';
import type {Aggregation} from 'sentry/utils/discover/fields';
import {
  AGGREGATIONS,
  explodeFieldString,
  generateFieldAsString,
} from 'sentry/utils/discover/fields';
import type {AlertType} from 'sentry/views/alerts/wizard/options';
import {
  hideParameterSelectorSet,
  hidePrimarySelectorSet,
} from 'sentry/views/alerts/wizard/options';
import {QueryField} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import type {OptionConfig} from './constants';
import {
  errorFieldConfig,
  getWizardAlertFieldConfig,
  transactionFieldConfig,
} from './constants';
import {Dataset} from './types';

type Props = Omit<FormFieldProps, 'children'> & {
  organization: Organization;
  alertType?: AlertType;
  /**
   * Optionally set a width for each column of selector
   */
  columnWidth?: number;
  inFieldLabels?: boolean;
};

export const getFieldOptionConfig = ({
  dataset,
  alertType,
}: {
  dataset: Dataset;
  alertType?: AlertType;
}) => {
  let config: OptionConfig;
  let hidePrimarySelector = false;
  let hideParameterSelector = false;
  if (alertType) {
    config = getWizardAlertFieldConfig(alertType, dataset);
    hidePrimarySelector = hidePrimarySelectorSet.has(alertType);
    hideParameterSelector = hideParameterSelectorSet.has(alertType);
  } else {
    config = dataset === Dataset.ERRORS ? errorFieldConfig : transactionFieldConfig;
  }
  const aggregations = Object.fromEntries<Aggregation>(
    config.aggregations.map(key => {
      // TODO(scttcper): Temporary hack for default value while we handle the translation of user
      if (key === 'count_unique') {
        const agg = AGGREGATIONS[key] as Aggregation;
        agg.getFieldOverrides = () => {
          return {defaultValue: 'tags[sentry:user]'};
        };
        return [key, agg];
      }

      return [key, AGGREGATIONS[key]];
    })
  );

  const fieldKeys = config.fields.map(key => {
    // XXX(epurkhiser): Temporary hack while we handle the translation of user ->
    // tags[sentry:user].
    if (key === 'user') {
      return 'tags[sentry:user]';
    }

    return key;
  });

  const {measurementKeys, spanOperationBreakdownKeys} = config;

  return {
    fieldOptionsConfig: {
      aggregations,
      fieldKeys,
      measurementKeys,
      spanOperationBreakdownKeys,
    },
    hidePrimarySelector,
    hideParameterSelector,
  };
};

function MetricField({
  organization,
  columnWidth,
  inFieldLabels,
  alertType,
  ...props
}: Props) {
  return (
    <FormField {...props}>
      {({onChange, value, model, disabled}) => {
        const dataset = model.getValue('dataset');

        const {fieldOptionsConfig, hidePrimarySelector, hideParameterSelector} =
          getFieldOptionConfig({
            dataset: dataset as Dataset,
            alertType,
          });
        const fieldOptions = generateFieldOptions({organization, ...fieldOptionsConfig});
        const fieldValue = explodeFieldString(value ?? '');

        const fieldKey =
          fieldValue?.kind === FieldValueKind.FUNCTION
            ? `function:${fieldValue.function[0]}`
            : '';

        const selectedField = fieldOptions[fieldKey]?.value;
        const numParameters: number =
          selectedField?.kind === FieldValueKind.FUNCTION
            ? selectedField.meta.parameters.length
            : 0;

        const parameterColumns =
          numParameters - (hideParameterSelector ? 1 : 0) - (hidePrimarySelector ? 1 : 0);

        return (
          <Fragment>
            <StyledQueryField
              filterPrimaryOptions={option =>
                option.value.kind === FieldValueKind.FUNCTION
              }
              fieldOptions={fieldOptions}
              fieldValue={fieldValue}
              onChange={v => onChange(generateFieldAsString(v), {})}
              columnWidth={columnWidth}
              gridColumns={parameterColumns + 1}
              inFieldLabels={inFieldLabels}
              shouldRenderTag={false}
              disabled={disabled}
              hideParameterSelector={hideParameterSelector}
              hidePrimarySelector={hidePrimarySelector}
            />
          </Fragment>
        );
      }}
    </FormField>
  );
}

const StyledQueryField = styled(QueryField)<{gridColumns: number; columnWidth?: number}>`
  ${p =>
    p.columnWidth &&
    css`
      width: ${p.gridColumns * p.columnWidth}px;
    `}
`;

export default MetricField;

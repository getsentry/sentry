import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {
  Aggregation,
  AGGREGATIONS,
  ColumnType,
  explodeFieldString,
  FIELDS,
  generateFieldAsString,
} from 'app/utils/discover/fields';
import {WizardMetricFieldConfigs} from 'app/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'app/views/alerts/wizard/utils';
import {QueryField} from 'app/views/eventsV2/table/queryField';
import {FieldValueKind} from 'app/views/eventsV2/table/types';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import FormField from 'app/views/settings/components/forms/formField';
import FormModel from 'app/views/settings/components/forms/model';

import {errorFieldConfig, OptionConfig, transactionFieldConfig} from './constants';
import {PRESET_AGGREGATES} from './presets';
import {Dataset} from './types';

type Props = Omit<FormField['props'], 'children'> & {
  organization: Organization;
  /**
   * Optionally set a width for each column of selector
   */
  columnWidth?: number;
  inFieldLabels?: boolean;
};

const getFieldOptionConfig = ({
  dataset,
  aggregate,
  organization,
}: {
  dataset: Dataset;
  aggregate: string;
  organization: Organization;
}) => {
  let config: OptionConfig;
  let hidePrimarySelector = false;
  let hideParameterSelector = false;
  if (organization.features.includes('alert-wizard')) {
    const alertType = getAlertTypeFromAggregateDataset({dataset, aggregate});
    config = WizardMetricFieldConfigs[alertType];
    // Hide selectors if they only show one option
    hidePrimarySelector = config.aggregations.length === 1;
    hideParameterSelector =
      (config.measurementKeys?.length ? 1 : 0) + config.fields.length === 1;
  } else {
    config = dataset === Dataset.ERRORS ? errorFieldConfig : transactionFieldConfig;
  }
  const aggregations = Object.fromEntries<Aggregation>(
    config.aggregations.map(key => {
      // TODO(scttcper): Temporary hack for default value while we handle the translation of user
      if (key === 'count_unique') {
        const agg = AGGREGATIONS[key] as Aggregation;
        agg.generateDefaultValue = () => 'tags[sentry:user]';
        return [key, agg];
      }

      return [key, AGGREGATIONS[key]];
    })
  );

  const fields = Object.fromEntries<ColumnType>(
    config.fields.map(key => {
      // XXX(epurkhiser): Temporary hack while we handle the translation of user ->
      // tags[sentry:user].
      if (key === 'user') {
        return ['tags[sentry:user]', 'string'];
      }

      return [key, FIELDS[key]];
    })
  );

  const {measurementKeys} = config;

  return {
    fieldOptionsConfig: {aggregations, fields, measurementKeys},
    hidePrimarySelector,
    hideParameterSelector,
  };
};

const help = ({name, model}: {name: string; model: FormModel}) => {
  const aggregate = model.getValue(name) as string;

  const presets = PRESET_AGGREGATES.filter(preset =>
    preset.validDataset.includes(model.getValue('dataset') as Dataset)
  )
    .map(preset => ({...preset, selected: preset.match.test(aggregate)}))
    .map((preset, i, list) => (
      <React.Fragment key={preset.name}>
        <Tooltip title={t('This preset is selected')} disabled={!preset.selected}>
          <PresetButton
            type="button"
            onClick={() => model.setValue(name, preset.default)}
            disabled={preset.selected}
          >
            {preset.name}
          </PresetButton>
        </Tooltip>
        {i + 1 < list.length && ', '}
      </React.Fragment>
    ));

  return tct(
    'Choose an aggregate function. Not sure what to select, try a preset: [presets]',
    {presets}
  );
};

const MetricField = ({organization, columnWidth, inFieldLabels, ...props}: Props) => (
  <FormField help={help} {...props}>
    {({onChange, value, model, disabled}) => {
      const dataset = model.getValue('dataset');
      const aggregate = model.getValue('aggregate');

      const {
        fieldOptionsConfig,
        hidePrimarySelector,
        hideParameterSelector,
      } = getFieldOptionConfig({
        dataset: dataset as Dataset,
        aggregate,
        organization,
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
        <React.Fragment>
          {!inFieldLabels && (
            <AggregateHeader>
              <div>{t('Function')}</div>
              {numParameters > 0 && <div>{t('Parameter')}</div>}
              {numParameters > 1 && <div>{t('Value')}</div>}
            </AggregateHeader>
          )}
          <StyledQueryField
            filterPrimaryOptions={option => option.value.kind === FieldValueKind.FUNCTION}
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
        </React.Fragment>
      );
    }}
  </FormField>
);

const StyledQueryField = styled(QueryField)<{gridColumns: number; columnWidth?: number}>`
  ${p =>
    p.columnWidth &&
    css`
      width: ${p.gridColumns * p.columnWidth}px;
    `}
`;

const AggregateHeader = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  grid-gap: ${space(1)};
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  font-weight: bold;
  margin-bottom: ${space(1)};
`;

const PresetButton = styled(Button)<{disabled: boolean}>`
  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.textColor};
      &:hover,
      &:focus {
        color: ${p.theme.textColor};
      }
    `}
`;

PresetButton.defaultProps = {
  priority: 'link',
  borderless: true,
};

export default MetricField;

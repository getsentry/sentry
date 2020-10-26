import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import FormField from 'app/views/settings/components/forms/formField';
import {t, tct} from 'app/locale';
import {QueryField} from 'app/views/eventsV2/table/queryField';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import {FieldValueKind} from 'app/views/eventsV2/table/types';
import {Organization} from 'app/types';
import space from 'app/styles/space';
import FormModel from 'app/views/settings/components/forms/model';
import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import {
  explodeFieldString,
  generateFieldAsString,
  AGGREGATIONS,
  FIELDS,
  measurementType,
} from 'app/utils/discover/fields';

import {errorFieldConfig, transactionFieldConfig} from './constants';
import {Dataset} from './types';
import {PRESET_AGGREGATES} from './presets';

type Props = Omit<FormField['props'], 'children' | 'help'> & {
  organization: Organization;
};

const getFieldOptionConfig = (dataset: Dataset, organization: Organization) => {
  const config = dataset === Dataset.ERRORS ? errorFieldConfig : transactionFieldConfig;

  const aggregations = Object.fromEntries(
    config.aggregations.map(key => [key, AGGREGATIONS[key]])
  );

  const hasMeasurementsFeature = organization.features.includes('measurements');

  const fields = Object.fromEntries(
    config.fields
      .filter(key => {
        if (key.startsWith('measurements.')) {
          return hasMeasurementsFeature;
        }
        return true;
      })
      .map(key => {
        // XXX(epurkhiser): Temporary hack while we handle the translation of user ->
        // tags[sentry:user].
        if (key === 'user') {
          return ['tags[sentry:user]', 'string'];
        }

        return [key, FIELDS[key]];
      })
  );

  return {aggregations, fields};
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

const MetricField = ({organization, ...props}: Props) => (
  <FormField help={help} {...props}>
    {({onChange, value, model}) => {
      const dataset = model.getValue('dataset');

      const fieldOptionsConfig = getFieldOptionConfig(dataset, organization);
      const fieldOptions = generateFieldOptions({organization, ...fieldOptionsConfig});
      const fieldValue = explodeFieldString(value ?? '');

      const fieldKey =
        fieldValue?.kind === FieldValueKind.FUNCTION
          ? `function:${fieldValue.function[0]}`
          : '';

      const selectedField = fieldOptions[fieldKey]?.value;
      const numParameters =
        selectedField &&
        selectedField.kind === FieldValueKind.FUNCTION &&
        selectedField.meta.parameters.length;

      return (
        <React.Fragment>
          <AggregateHeader>
            <div>{t('Function')}</div>
            {numParameters > 0 && <div>{t('Parameter')}</div>}
          </AggregateHeader>
          <QueryField
            filterPrimaryOptions={option => option.value.kind === FieldValueKind.FUNCTION}
            fieldOptions={fieldOptions}
            fieldValue={fieldValue}
            onChange={v => onChange(generateFieldAsString(v), {})}
          />
        </React.Fragment>
      );
    }}
  </FormField>
);

const AggregateHeader = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  grid-gap: ${space(1)};
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
  font-weight: bold;
  margin-bottom: ${space(1)};
`;

const PresetButton = styled(Button)<{disabled: boolean}>`
  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.gray700};
      &:hover,
      &:focus {
        color: ${p.theme.gray800};
      }
    `}
`;

PresetButton.defaultProps = {
  priority: 'link',
  borderless: true,
};

export default MetricField;

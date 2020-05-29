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
  AggregationKey,
  FieldKey,
  AGGREGATIONS,
  FIELDS,
} from 'app/utils/discover/fields';

import {Dataset} from './types';
import {PRESET_AGGREGATES} from './presets';

type Props = Omit<FormField['props'], 'children' | 'help'> & {
  organization: Organization;
};

type OptionConfig = {
  aggregations: AggregationKey[];
  fields: FieldKey[];
};

const errorFieldConfig: OptionConfig = {
  aggregations: ['count', 'count_unique'],
  fields: ['user'],
};

const transactionFieldConfig: OptionConfig = {
  aggregations: [
    'avg',
    'percentile',
    'failure_rate',
    'apdex',
    'count',
    'p50',
    'p75',
    'p95',
    'p99',
    'p100',
  ],
  fields: ['transaction.duration'],
};

const getFieldOptionConfig = (dataset: Dataset) => {
  const config = dataset === Dataset.ERRORS ? errorFieldConfig : transactionFieldConfig;

  const aggregations = Object.fromEntries(
    config.aggregations.map(key => [key, AGGREGATIONS[key]])
  );
  const fields = Object.fromEntries(
    config.fields.map(key => {
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
          <PresetLink
            onClick={() => model.setValue(name, preset.default)}
            isSelected={preset.selected}
          >
            {preset.name}
          </PresetLink>
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

      const fieldOptionsConfig = getFieldOptionConfig(dataset);
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

const PresetLink = styled(Button)<{isSelected: boolean}>`
  ${p =>
    p.isSelected &&
    css`
      color: ${p.theme.gray700};
      &:hover,
      &:focus {
        color: ${p.theme.gray800};
      }
    `}
`;

PresetLink.defaultProps = {
  priority: 'link',
  borderless: true,
};

export default MetricField;

import React from 'react';
import {components, OptionProps} from 'react-select';
import styled from '@emotion/styled';

import SelectControl from 'app/components/forms/selectControl';
import Highlight from 'app/components/highlight';
import {t} from 'app/locale';
import SelectField from 'app/views/settings/components/forms/selectField';

import {Metric} from './types';

type Props = {
  metrics: Metric[];
  onChange: <F extends keyof Pick<Props, 'metric' | 'aggregation'>>(
    field: F,
    value: Props[F]
  ) => void;
  aggregation?: Metric['operations'][0];
  metric?: Metric;
};

function MetricSelectField({metrics, metric, aggregation, onChange}: Props) {
  const operations = metric?.operations ?? [];
  return (
    <Wrapper>
      <StyledSelectField
        name="metric"
        choices={metrics.map(m => [m.name, m.name])}
        placeholder={t('Select metric')}
        onChange={v => {
          const newMetric = metrics.find(m => m.name === v);
          onChange('metric', newMetric);
        }}
        value={metric?.name}
        components={{
          Option: ({
            label,
            ...optionProps
          }: OptionProps<{
            label: string;
            value: string;
          }>) => {
            const {selectProps} = optionProps;
            const {inputValue} = selectProps;

            return (
              <components.Option label={label} {...optionProps}>
                <Highlight text={inputValue ?? ''}>{label}</Highlight>
              </components.Option>
            );
          },
        }}
        styles={{
          control: provided => ({
            ...provided,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            borderRight: 'none',
          }),
        }}
        inline={false}
        flexibleControlStateSize
        stacked
        allowClear
      />
      <StyledSelectControl
        name="aggregation"
        placeholder={t('Aggr')}
        disabled={!operations.length}
        options={operations.map(operation => ({
          label: operation,
          value: operation,
        }))}
        value={aggregation ?? ''}
        onChange={v => onChange('aggregation', v)}
        styles={{
          control: provided => ({
            ...provided,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          }),
        }}
      />
    </Wrapper>
  );
}

export default MetricSelectField;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
  padding-bottom: 0;
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 0.4fr;
`;

const StyledSelectControl = styled(SelectControl)``;

import React from 'react';
import {components, OptionProps} from 'react-select';

import Highlight from 'app/components/highlight';
import {t} from 'app/locale';
import SelectField from 'app/views/settings/components/forms/selectField';

import BuildStep from '../buildStep';
import {metrics} from '../utils';

import Queries from './queries';

type Props = Omit<React.ComponentProps<typeof Queries>, 'queries'> & {
  metricQueries: React.ComponentProps<typeof Queries>['queries'];
  onChangeField: (field: 'metric', value: string) => void;
};

function MetricSteps({
  metricQueries,
  onAddQuery,
  onRemoveQuery,
  onChangeQuery,
  onChangeField,
}: Props) {
  return (
    <React.Fragment>
      <BuildStep
        title={t('Choose your y-axis metric')}
        description={t('Determine what type of metric you want to graph by.')}
      >
        <SelectField
          name="metric"
          choices={metrics.map(metric => [metric, metric])}
          placeholder={t('Select metric')}
          onChange={value => onChangeField('metric', String(value))}
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
          style={{paddingRight: 0}}
          inline={false}
          flexibleControlStateSize
          stacked
          allowClear
        />
      </BuildStep>
      <BuildStep
        title={t('Begin your search')}
        description={t('Add another query to compare projects, organizations, etc.')}
      >
        <Queries
          queries={metricQueries}
          onAddQuery={onAddQuery}
          onRemoveQuery={onRemoveQuery}
          onChangeQuery={onChangeQuery}
        />
      </BuildStep>
    </React.Fragment>
  );
}

export default MetricSteps;

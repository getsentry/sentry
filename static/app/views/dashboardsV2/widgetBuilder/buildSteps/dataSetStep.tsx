import styled from '@emotion/styled';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {t} from 'sentry/locale';
import {DisplayType} from 'sentry/views/dashboardsV2/types';

import {DataSet} from '../utils';

import {BuildStep} from './buildStep';

const DATASET_CHOICES: [DataSet, string][] = [
  [DataSet.EVENTS, t('All Events (Errors and Transactions)')],
  [DataSet.ISSUES, t('Issues (States, Assignment, Time, etc.)')],
  // [DataSet.METRICS, t('Metrics (Release Health)')],
];

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  onChange: (dataSet: DataSet) => void;
}

export function DataSetStep({dataSet, onChange, displayType}: Props) {
  return (
    <BuildStep
      title={t('Choose your data set')}
      description={t(
        'This reflects the type of information you want to use. For a full list, read the docs.'
      )}
    >
      <DataSetChoices
        label="dataSet"
        value={dataSet}
        choices={DATASET_CHOICES}
        disabledChoices={
          displayType !== DisplayType.TABLE
            ? [
                [
                  DataSet.ISSUES,
                  t('This data set is restricted to the table visualization.'),
                ],
              ]
            : undefined
        }
        onChange={newDataSet => {
          onChange(newDataSet as DataSet);
        }}
      />
    </BuildStep>
  );
}

const DataSetChoices = styled(RadioGroup)`
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-auto-flow: column;
  }
`;

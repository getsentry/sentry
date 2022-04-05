import styled from '@emotion/styled';

import RadioGroup, {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DisplayType} from 'sentry/views/dashboardsV2/types';

import {DataSet} from '../utils';

import {BuildStep} from './buildStep';

const DATASET_CHOICES: [DataSet, string][] = [
  [DataSet.EVENTS, t('Events (Errors, transactions)')],
  [DataSet.ISSUES, t('Issues (Status, assignee, etc.)')],
];

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  onChange: (dataSet: DataSet) => void;
  widgetBuilderNewDesign: boolean;
}

export function DataSetStep({
  dataSet,
  onChange,
  widgetBuilderNewDesign,
  displayType,
}: Props) {
  const disabledChoices: RadioGroupProps<string>['disabledChoices'] = [];

  if (displayType !== DisplayType.TABLE) {
    disabledChoices.push([
      DataSet.ISSUES,
      t('This data set is restricted to tabular visualization.'),
    ]);

    if (displayType === DisplayType.WORLD_MAP) {
      disabledChoices.push([
        DataSet.RELEASE,
        t(
          'This data set is restricted to big number, tabular and time series visualizations.'
        ),
      ]);
    }
  }

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
        choices={
          widgetBuilderNewDesign
            ? [
                ...DATASET_CHOICES,
                [DataSet.RELEASE, t('Releases (sessions, crash rates)')],
              ]
            : DATASET_CHOICES
        }
        disabledChoices={disabledChoices}
        onChange={newDataSet => {
          onChange(newDataSet as DataSet);
        }}
      />
    </BuildStep>
  );
}

const DataSetChoices = styled(RadioGroup)`
  gap: ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-auto-flow: column;
  }
`;

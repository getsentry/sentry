import styled from '@emotion/styled';

import RadioGroup, {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DisplayType} from 'sentry/views/dashboardsV2/types';

import {DataSet} from '../utils';

import {BuildStep} from './buildStep';

const DATASET_CHOICES: [DataSet, string][] = [
  [DataSet.EVENTS, t('Errors and Transactions')],
  [DataSet.ISSUES, t('Issues (States, Assignment, Time, etc.)')],
];

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  hasReleaseHealthFeature: boolean;
  onChange: (dataSet: DataSet) => void;
}

export function DataSetStep({
  dataSet,
  onChange,
  hasReleaseHealthFeature,
  displayType,
}: Props) {
  const disabledChoices: RadioGroupProps<string>['disabledChoices'] = [];

  if (displayType !== DisplayType.TABLE) {
    disabledChoices.push([
      DataSet.ISSUES,
      t('This dataset is restricted to tabular visualization.'),
    ]);

    if (displayType === DisplayType.WORLD_MAP) {
      disabledChoices.push([
        DataSet.RELEASES,
        t(
          'This dataset is restricted to big number, tabular and time series visualizations.'
        ),
      ]);
    }
  }

  return (
    <BuildStep
      title={t('Choose your dataset')}
      description={tct(
        `This reflects the type of information you want to use. To learn more, [link: read the docs].`,
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/product/dashboards/custom-dashboards/#data-set-selection" />
          ),
        }
      )}
    >
      <DataSetChoices
        label="dataSet"
        value={dataSet}
        choices={
          hasReleaseHealthFeature
            ? [
                ...DATASET_CHOICES,
                [DataSet.RELEASES, t('Releases (sessions, crash rates)')],
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
  display: flex;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

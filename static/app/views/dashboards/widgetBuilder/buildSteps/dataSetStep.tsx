import {useMemo} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import RadioGroup, {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {DisplayType} from 'sentry/views/dashboards/types';

import {canSeeDiscoverSplit, DataSet} from '../utils';

import {BuildStep} from './buildStep';

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
  const org = useOrganization();
  const disabledChoices: RadioGroupProps<string>['disabledChoices'] = [];
  const showDiscoverSplitWarning = useMemo(
    () => dataSet === DataSet.EVENTS && canSeeDiscoverSplit(org),
    [org]
  );

  if (displayType !== DisplayType.TABLE) {
    disabledChoices.push([
      DataSet.ISSUES,
      t('This dataset is restricted to tabular visualization.'),
    ]);
  }

  const datasetChoices = new Map<string, string>();
  if (canSeeDiscoverSplit(org)) {
    datasetChoices.set(DataSet.ERROR_EVENTS, t('Errors'));
    datasetChoices.set(DataSet.TRANSACTION_LIKE, t('Transactions'));
  } else {
    datasetChoices.set(DataSet.EVENTS, t('Errors & Transactions'));
  }

  datasetChoices.set(DataSet.ISSUES, t('Issues (States, Assignment, Time, etc.)'));

  if (hasReleaseHealthFeature) {
    datasetChoices.set(DataSet.RELEASES, t('Releases (Sessions, Crash rates)'));
  }

  return (
    <BuildStep
      title={t('Choose your dataset')}
      description={tct(
        `This reflects the type of information you want to use. To learn more, [link: read the docs].`,
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/product/dashboards/widget-builder/#choose-your-dataset" />
          ),
        }
      )}
    >
      {showDiscoverSplitWarning ? (
        <Alert showIcon type="warning">
          {t(
            'This dataset is deprecated as it is being split into a separate dataset for both errors and transactions. All existing widgets still using this dataset will be migrated May 1st, 2024'
          )}
        </Alert>
      ) : null}
      <DataSetChoices
        label="dataSet"
        value={dataSet}
        choices={[...datasetChoices.entries()]}
        disabledChoices={disabledChoices}
        onChange={newDataSet => {
          onChange(newDataSet as DataSet);
        }}
        orientInline
      />
    </BuildStep>
  );
}

const DataSetChoices = styled(RadioGroup)`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

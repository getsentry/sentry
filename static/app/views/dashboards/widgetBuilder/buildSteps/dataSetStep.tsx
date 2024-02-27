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
  discoverWidgetSplit?: DataSet;
}

export function DataSetStep({
  dataSet,
  discoverWidgetSplit,
  onChange,
  hasReleaseHealthFeature,
  displayType,
}: Props) {
  const org = useOrganization();
  const disabledChoices: RadioGroupProps<string>['disabledChoices'] = [];
  const doesSeeDiscoverSplit = canSeeDiscoverSplit(org);
  const showDiscoverSplitWarning = useMemo(
    () => dataSet === DataSet.EVENTS && doesSeeDiscoverSplit && !discoverWidgetSplit,
    [dataSet, doesSeeDiscoverSplit, discoverWidgetSplit]
  );
  // We derive the dataset from either the actual set dataset on the widget, or temporarily use discoverWidgetSplit if it's a discover widget and in the process of being split.
  const derivedDataSet =
    doesSeeDiscoverSplit && discoverWidgetSplit ? discoverWidgetSplit : dataSet;

  if (displayType !== DisplayType.TABLE) {
    disabledChoices.push([
      DataSet.ISSUES,
      t('This dataset is restricted to tabular visualization.'),
    ]);
  }

  const datasetChoices = new Map<string, string>();
  if (doesSeeDiscoverSplit) {
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
        value={derivedDataSet}
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

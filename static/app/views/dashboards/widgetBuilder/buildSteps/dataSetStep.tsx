import {useEffect} from 'react';
import styled from '@emotion/styled';

import type {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageAlert,
  PageAlertProvider,
  usePageAlert,
} from 'sentry/utils/performance/contexts/pageAlert';
import useOrganization from 'sentry/utils/useOrganization';
import {DisplayType, type WidgetType} from 'sentry/views/dashboards/types';
import {DATASET_LABEL_MAP} from 'sentry/views/discover/savedQuery/datasetSelector';

import {DataSet} from '../utils';

import {BuildStep} from './buildStep';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  hasReleaseHealthFeature: boolean;
  onChange: (dataSet: DataSet) => void;
  splitDecision?: WidgetType;
}

export function DataSetStep({
  dataSet,
  onChange,
  hasReleaseHealthFeature,
  displayType,
  splitDecision,
}: Props) {
  const {setPageWarning} = usePageAlert();
  const organization = useOrganization();
  const disabledChoices: RadioGroupProps<string>['disabledChoices'] = [];

  useEffect(() => {
    if (splitDecision) {
      setPageWarning(
        tct(
          "We're splitting our datasets up to make it a bit easier to digest. We defaulted this query to [splitDecision]. Edit as you see fit.",
          {splitDecision: DATASET_LABEL_MAP[splitDecision]}
        )
      );
    }
  }, [setPageWarning, splitDecision]);

  if (displayType !== DisplayType.TABLE) {
    disabledChoices.push([
      DataSet.ISSUES,
      t('This dataset is restricted to tabular visualization.'),
    ]);
  }

  const datasetChoices = new Map<string, string>();

  if (organization.features.includes('performance-discover-dataset-selector')) {
    // TODO: Finalize description copy
    datasetChoices.set(DataSet.ERRORS, t('Errors (TypeError, InvalidSearchQuery, etc)'));
    datasetChoices.set(DataSet.TRANSACTIONS, t('Transactions'));
  }

  if (!organization.features.includes('performance-discover-dataset-selector')) {
    datasetChoices.set(DataSet.EVENTS, t('Errors and Transactions'));
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
      <PageAlert />
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

export default function WrappedDataSetStep({
  dataSet,
  onChange,
  hasReleaseHealthFeature,
  displayType,
  splitDecision,
}: Props) {
  return (
    <PageAlertProvider>
      <DataSetStep
        dataSet={dataSet}
        onChange={onChange}
        hasReleaseHealthFeature={hasReleaseHealthFeature}
        displayType={displayType}
        splitDecision={splitDecision}
      />
    </PageAlertProvider>
  );
}

const DataSetChoices = styled(RadioGroup)`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

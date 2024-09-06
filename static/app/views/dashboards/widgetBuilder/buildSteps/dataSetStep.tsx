import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import type {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DatasetSource} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {DisplayType, type WidgetType} from 'sentry/views/dashboards/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {DATASET_LABEL_MAP} from 'sentry/views/discover/savedQuery/datasetSelectorTabs';

import {DataSet} from '../utils';

import {BuildStep} from './buildStep';

function DiscoverSplitAlert({onDismiss, splitDecision}) {
  const splitAlertMessage = splitDecision
    ? tct(
        "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to [splitDecision]. Edit as you see fit.",
        {splitDecision: DATASET_LABEL_MAP[splitDecision]}
      )
    : null;

  return (
    <Alert
      type="warning"
      showIcon
      trailingItems={
        <StyledCloseButton
          icon={<IconClose size="sm" />}
          aria-label={t('Close')}
          onClick={onDismiss}
          size="zero"
          borderless
        />
      }
    >
      {splitAlertMessage}
    </Alert>
  );
}

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  onChange: (dataSet: DataSet) => void;
  source?: DatasetSource;
  splitDecision?: WidgetType;
}

export function DataSetStep({
  dataSet,
  onChange,
  displayType,
  splitDecision,
  source,
}: Props) {
  const [showSplitAlert, setShowSplitAlert] = useState<boolean>(
    source === DatasetSource.FORCED
  );
  const organization = useOrganization();
  const disabledChoices: RadioGroupProps<string>['disabledChoices'] = [];
  const hasDatasetSelectorFeature = hasDatasetSelector(organization);

  useEffect(() => {
    setShowSplitAlert(!!splitDecision);
  }, [splitDecision]);

  if (displayType !== DisplayType.TABLE) {
    disabledChoices.push([
      DataSet.ISSUES,
      t('This dataset is restricted to tabular visualization.'),
    ]);
  }

  const datasetChoices = new Map<string, string>();

  if (hasDatasetSelectorFeature) {
    // TODO: Finalize description copy
    datasetChoices.set(DataSet.ERRORS, t('Errors (TypeError, InvalidSearchQuery, etc)'));
    datasetChoices.set(DataSet.TRANSACTIONS, t('Transactions'));
  }

  if (!hasDatasetSelectorFeature) {
    datasetChoices.set(DataSet.EVENTS, t('Errors and Transactions'));
  }
  datasetChoices.set(DataSet.ISSUES, t('Issues (States, Assignment, Time, etc.)'));

  datasetChoices.set(DataSet.RELEASES, t('Releases (Sessions, Crash rates)'));

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
      {showSplitAlert && hasDatasetSelectorFeature && (
        <DiscoverSplitAlert
          onDismiss={() => setShowSplitAlert(false)}
          splitDecision={splitDecision}
        />
      )}
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

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;

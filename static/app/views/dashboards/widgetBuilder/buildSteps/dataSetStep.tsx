import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
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

function DiscoverSplitAlert({onDismiss, splitDecision}: any) {
  const splitAlertMessage = splitDecision
    ? tct(
        "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to [splitDecision]. Edit as you see fit.",
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        {splitDecision: DATASET_LABEL_MAP[splitDecision]}
      )
    : null;

  return (
    <Alert.Container>
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
    </Alert.Container>
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

  const datasetChoices = new Map<string, string | React.ReactNode>();

  if (hasDatasetSelectorFeature) {
    // TODO: Finalize description copy
    datasetChoices.set(DataSet.ERRORS, t('Errors (TypeError, InvalidSearchQuery, etc)'));
    datasetChoices.set(DataSet.TRANSACTIONS, t('Transactions'));
  }

  if (!hasDatasetSelectorFeature) {
    datasetChoices.set(DataSet.EVENTS, t('Errors and Transactions'));
  }

  if (organization.features.includes('dashboards-eap')) {
    datasetChoices.set(
      DataSet.SPANS,
      <FeatureBadgeAlignmentWrapper aria-label={t('Spans')}>
        {t('Spans')}{' '}
        <FeatureBadge
          type="beta"
          tooltipProps={{
            title: t(
              'This feature is available for early adopters and the UX may change'
            ),
          }}
        />
      </FeatureBadgeAlignmentWrapper>
    );
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

const FeatureBadgeAlignmentWrapper = styled('div')`
  ${FeatureBadge} {
    position: relative;
    top: -1px;
  }
`;

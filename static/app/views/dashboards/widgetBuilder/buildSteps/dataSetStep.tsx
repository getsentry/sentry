import styled from '@emotion/styled';

import type {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {DisplayType} from 'sentry/views/dashboards/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';

import {DataSet} from '../utils';

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
  const organization = useOrganization();
  const disabledChoices: RadioGroupProps<string>['disabledChoices'] = [];

  if (displayType !== DisplayType.TABLE) {
    disabledChoices.push([
      DataSet.ISSUES,
      t('This dataset is restricted to tabular visualization.'),
    ]);
  }

  const datasetChoices = new Map<string, string>();

  if (hasDatasetSelector(organization)) {
    // TODO: Finalize description copy
    datasetChoices.set(DataSet.ERRORS, t('Errors (TypeError, InvalidSearchQuery, etc)'));
    datasetChoices.set(DataSet.TRANSACTIONS, t('Transactions'));
  }

  if (!hasDatasetSelector(organization)) {
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

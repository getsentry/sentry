import {Fragment} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import RadioGroup, {type RadioOption} from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

function WidgetBuilderDatasetSelector() {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();

  const datasetChoices: RadioOption<WidgetType>[] = [];
  datasetChoices.push([WidgetType.ERRORS, t('Errors')]);
  datasetChoices.push([WidgetType.TRANSACTIONS, t('Transactions')]);

  if (organization.features.includes('dashboards-eap')) {
    datasetChoices.push([
      WidgetType.SPANS,
      <FeatureBadgeAlignmentWrapper aria-label={t('Spans')} key={'dataset-choice-spans'}>
        {t('Spans')} <FeatureBadge type="alpha" />
      </FeatureBadgeAlignmentWrapper>,
    ]);
  }
  datasetChoices.push([WidgetType.ISSUE, t('Issues')]);
  datasetChoices.push([WidgetType.RELEASE, t('Releases')]);

  return (
    <Fragment>
      <StyledSectionHeader
        title={t('Dataset')}
        tooltipText={tct(
          `This reflects the type of information you want to use. To learn more, [link: read the docs].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/dashboards/widget-builder/#choose-your-dataset" />
            ),
          }
        )}
      />
      <DatasetChoices
        label={t('Dataset')}
        value={state.dataset ?? WidgetType.ERRORS}
        choices={datasetChoices}
        onChange={(newValue: WidgetType) =>
          dispatch({
            type: BuilderStateAction.SET_DATASET,
            payload: newValue,
          })
        }
      />
    </Fragment>
  );
}

export default WidgetBuilderDatasetSelector;

const DatasetChoices = styled(RadioGroup<WidgetType>)`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const FeatureBadgeAlignmentWrapper = styled('div')`
  ${FeatureBadge} {
    position: relative;
    top: -1px;
  }
`;

const StyledSectionHeader = styled(SectionHeader)`
  margin-bottom: ${space(2)};
`;

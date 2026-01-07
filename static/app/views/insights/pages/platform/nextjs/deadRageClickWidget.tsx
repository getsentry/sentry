import {Fragment} from 'react';
import styled from '@emotion/styled';

import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import useOrganization from 'sentry/utils/useOrganization';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';
import {SelectorLink} from 'sentry/views/replays/selectors/selectorLink';
import {transformSelectorQuery} from 'sentry/views/replays/selectors/utils';
import type {DeadRageSelectorItem} from 'sentry/views/replays/types';

export function DeadRageClicksWidget() {
  const organization = useOrganization();
  const hasReplays = organization.features.includes('session-replay-ui');
  const {isLoading, error, data} = useDeadRageSelectors({
    per_page: 6,
    sort: '-count_dead_clicks',
    cursor: undefined,
    // Setting this to true just strips rage clicks from the data
    isWidgetData: false,
    enabled: hasReplays,
  });

  const isEmpty = !isLoading && data.length === 0;

  if (!hasReplays) {
    return (
      <Widget
        Title={<Widget.WidgetTitle title={t('Rage & Dead Clicks')} />}
        Visualization={
          <FeatureWrapper>
            <FeatureDisabled
              features="organizations:session-replay-ui"
              featureName={t('Replays')}
              hideHelpToggle
            />
          </FeatureWrapper>
        }
      />
    );
  }

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage={
        <GenericWidgetEmptyStateWarning
          message={t('Rage or dead clicks may not be listed due to the filters above')}
        />
      }
      VisualizationType={DeadRageClickWidgetVisualization}
      visualizationProps={{
        items: data,
      }}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Rage & Dead Clicks')} />}
      Visualization={visualization}
      noVisualizationPadding
    />
  );
}

function DeadRageClickWidgetVisualization({items}: {items: DeadRageSelectorItem[]}) {
  return (
    <ClicksGrid>
      {items.map((item, index) => (
        <Fragment key={index}>
          <ClicksGridCell>
            <SelectorLink
              value={item.dom_element.selector}
              selectorQuery={`dead.selector:"${transformSelectorQuery(item.dom_element.fullSelector)}"`}
              projectId={item.project_id.toString()}
            />
          </ClicksGridCell>
          <ClicksGridCell>
            <ClickCount>
              <IconCursorArrow size="xs" color="yellow300" />
              {item.count_dead_clicks || 0}
            </ClickCount>
          </ClicksGridCell>
          <ClicksGridCell>
            <ClickCount>
              <IconCursorArrow size="xs" variant="danger" />
              {item.count_rage_clicks || 0}
            </ClickCount>
          </ClicksGridCell>
        </Fragment>
      ))}
    </ClicksGrid>
  );
}

DeadRageClickWidgetVisualization.LoadingPlaceholder =
  TimeSeriesWidgetVisualization.LoadingPlaceholder;

const COLUMN_COUNT = 3;

const ClicksGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr repeat(${COLUMN_COUNT - 1}, min-content);
  grid-auto-rows: min-content;
  margin-top: ${space(1)};
  overflow-y: auto;
`;

const ClicksGridCell = styled('div')`
  padding: ${space(1.5)} ${space(1)};
  min-width: 0;
  overflow: hidden;
  border-top: 1px solid ${p => p.theme.border};
  &:nth-child(${COLUMN_COUNT}n + 1) {
    padding-left: ${space(2)};
  }
  &:nth-child(${COLUMN_COUNT}n) {
    padding-right: ${space(2)};
  }
`;

const ClickCount = styled(TextOverflow)`
  color: ${p => p.theme.colors.gray500};
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(0.75)};
  align-items: center;
`;

const FeatureWrapper = styled('div')`
  padding-top: ${p => p.theme.space.md};
`;

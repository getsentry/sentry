import {Fragment} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {LinkButton} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {Release} from 'sentry/views/dashboards/widgets/common/types';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {SlowSSRWidget} from 'sentry/views/insights/pages/platform/nextjs/slowSsrWidget';
import {
  SelectorLink,
  transformSelectorQuery,
} from 'sentry/views/replays/deadRageClick/selectorTable';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {DeadRageSelectorItem} from 'sentry/views/replays/types';

export function DeadRageClicksWidget({
  query,
  releases,
}: {
  query?: string;
  releases?: Release[];
}) {
  const organization = useOrganization();
  const location = useLocation();
  const fullQuery = `!count_dead_clicks:0 ${query}`.trim();

  const {isLoading, error, data} = useDeadRageSelectors({
    per_page: 5,
    sort: '-count_dead_clicks',
    cursor: undefined,
    query: fullQuery,
    isWidgetData: true,
  });

  const isEmpty = !isLoading && data.length === 0;

  if (isEmpty) {
    return <SlowSSRWidget query={query} releases={releases} />;
  }

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      VisualizationType={DeadRageClickWidgetVisualization}
      visualizationProps={{
        items: data,
      }}
    />
  );

  const allSelectorsPath = makeReplaysPathname({
    path: '/selectors/',
    organization,
  });

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Rage & Dead Clicks')} />}
      Visualization={visualization}
      noVisualizationPadding
      Actions={
        <LinkButton
          size="xs"
          to={{
            pathname: allSelectorsPath,
            query: {
              ...location.query,
              sort: '-count_dead_clicks',
              query: undefined,
              cursor: undefined,
            },
          }}
        >
          {t('View all')}
        </LinkButton>
      }
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
              <IconCursorArrow size="xs" color="yellow400" />
              {item.count_dead_clicks || 0}
            </ClickCount>
          </ClicksGridCell>
          <ClicksGridCell>
            <ClickCount>
              <IconCursorArrow size="xs" color="red400" />
              {item.count_rage_clicks || 0}
            </ClickCount>
          </ClicksGridCell>
          <ClicksGridCell>
            <ProjectInfo id={item.project_id} />
          </ClicksGridCell>
        </Fragment>
      ))}
    </ClicksGrid>
  );
}

DeadRageClickWidgetVisualization.LoadingPlaceholder =
  TimeSeriesWidgetVisualization.LoadingPlaceholder;

function ProjectInfo({id}: {id: number}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === id.toString());
  const platform = project?.platform;
  const slug = project?.slug;
  return (
    <ProjectInfoWrapper>
      <Tooltip title={slug}>
        <PlatformIcon
          style={{display: 'block'}}
          size={16}
          platform={platform ?? 'default'}
        />
      </Tooltip>
    </ProjectInfoWrapper>
  );
}

const COLUMN_COUNT = 4;

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
  color: ${p => p.theme.gray400};
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(0.75)};
  align-items: center;
`;

const ProjectInfoWrapper = styled('div')`
  display: block;
  width: 16px;
  height: 16px;
`;

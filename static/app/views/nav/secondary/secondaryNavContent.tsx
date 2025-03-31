import {DashboardsSecondaryNav} from 'sentry/views/nav/secondary/sections/dashboards/dashboardsSecondaryNav';
import {ExploreSecondaryNav} from 'sentry/views/nav/secondary/sections/explore/exploreSecondaryNav';
import {InsightsSecondaryNav} from 'sentry/views/nav/secondary/sections/insights/insightsSecondaryNav';
import {IssuesSecondaryNav} from 'sentry/views/nav/secondary/sections/issues/issuesSecondaryNav';
import PipelineSecondaryNav from 'sentry/views/nav/secondary/sections/pipeline/pipelineSecondaryNav';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

export function SecondaryNavContent() {
  const activeNavGroup = useActiveNavGroup();

  switch (activeNavGroup) {
    case PrimaryNavGroup.ISSUES:
      return <IssuesSecondaryNav />;
    case PrimaryNavGroup.INSIGHTS:
      return <InsightsSecondaryNav />;
    case PrimaryNavGroup.DASHBOARDS:
      return <DashboardsSecondaryNav />;
    case PrimaryNavGroup.EXPLORE:
      return <ExploreSecondaryNav />;
    case PrimaryNavGroup.PIPELINE:
      return <PipelineSecondaryNav />;
    default:
      return null;
  }
}

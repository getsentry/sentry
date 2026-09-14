import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {EmbedStory, EmbedVariant} from './embedStory';

export function DashboardEmbedStory() {
  const organization = useOrganization();
  const {
    data: dashboards,
    isError,
    isPending,
  } = useQuery(dashboardsApiOptions(organization, {query: {per_page: 100}}));
  const dashboard = dashboards?.find(candidate => candidate.widgetDisplay.length > 0);

  return (
    <EmbedStory name="dashboard">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a dashboard example.</Text>
      ) : dashboard ? (
        <EmbedVariant
          name="dashboard"
          label="Dashboard"
          data={{id: dashboard.id, title: dashboard.title}}
          demoProps={{minHeight: undefined, maxHeight: undefined, overflow: undefined}}
        />
      ) : (
        <Text variant="muted">No dashboard is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}

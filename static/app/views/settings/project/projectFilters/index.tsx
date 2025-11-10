import {Fragment} from 'react';
import styled from '@emotion/styled';

import {TabList, Tabs} from 'sentry/components/core/tabs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import recreateRoute from 'sentry/utils/recreateRoute';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import GroupTombstones from 'sentry/views/settings/project/projectFilters/groupTombstones';
import {ProjectFiltersChart} from 'sentry/views/settings/project/projectFilters/projectFiltersChart';
import {ProjectFiltersSettings} from 'sentry/views/settings/project/projectFilters/projectFiltersSettings';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

export default function ProjectFilters() {
  const routes = useRoutes();
  const params = useParams<{filterType: string; projectId: string}>();
  const {projectId, filterType} = params;
  const {project} = useProjectSettingsOutlet();

  if (!project) {
    return null;
  }

  const features = new Set(project.features);

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Inbound Filters')} projectSlug={projectId} />
      <SettingsPageHeader title={t('Inbound Data Filters')} />
      <TextBlock>
        {t(
          'Filters allow you to prevent Sentry from storing events in certain situations. Filtered events are tracked separately from rate limits, and do not apply to any project quotas.'
        )}
      </TextBlock>

      <ProjectPermissionAlert project={project} />

      <div>
        <ProjectFiltersChart project={project} />

        {features.has('discard-groups') && (
          <TabsContainer>
            <Tabs value={filterType}>
              <TabList>
                <TabList.Item
                  key="data-filters"
                  to={recreateRoute('data-filters/', {routes, params, stepBack: -1})}
                >
                  {t('Data Filters')}
                </TabList.Item>
                <TabList.Item
                  key="discarded-groups"
                  to={recreateRoute('discarded-groups/', {routes, params, stepBack: -1})}
                >
                  {t('Discarded Issues')}
                </TabList.Item>
              </TabList>
            </Tabs>
          </TabsContainer>
        )}

        {filterType === 'discarded-groups' ? (
          <GroupTombstones project={project} />
        ) : (
          <ProjectFiltersSettings project={project} params={params} features={features} />
        )}
      </div>
    </Fragment>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

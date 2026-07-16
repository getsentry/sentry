import {Fragment} from 'react';
import styled from '@emotion/styled';

import {TabList, Tabs} from '@sentry/scraps/tabs';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {GroupTombstones} from 'sentry/views/settings/project/projectFilters/groupTombstones';
import {ProjectFiltersChart} from 'sentry/views/settings/project/projectFilters/projectFiltersChart';
import {ProjectFiltersSettings} from 'sentry/views/settings/project/projectFilters/projectFiltersSettings';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {CustomFilters} from './customFilters';

export default function ProjectFilters() {
  const routes = useRoutes();
  const params = useParams<{filterType: string; projectId: string}>();
  const {projectId, filterType} = params;
  const {project} = useProjectSettingsOutlet();
  const organization = useOrganization();

  if (!project) {
    return null;
  }

  const features = new Set(project.features);
  const hasInboundFiltersV2 = organization.features.includes('inbound-filters-v2');
  const hasDiscardGroups = features.has('discard-groups');
  const showTabs = hasDiscardGroups || hasInboundFiltersV2;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Inbound Filters')} projectSlug={projectId} />
      <SettingsPageHeader
        title={t('Inbound Data Filters')}
        subtitle={t(
          'Filters allow you to prevent Sentry from storing events in certain situations. Filtered events are tracked separately from rate limits, and do not apply to any project quotas.'
        )}
      />

      <ProjectPermissionAlert project={project} />

      <div>
        <ProjectFiltersChart project={project} />

        {showTabs && (
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
                  key="inbound-filters"
                  hidden={!hasInboundFiltersV2}
                  to={recreateRoute('inbound-filters/', {
                    routes,
                    params,
                    stepBack: -1,
                  })}
                >
                  {t('Custom Filters')}
                </TabList.Item>
                <TabList.Item
                  key="discarded-groups"
                  hidden={!hasDiscardGroups}
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
        ) : hasInboundFiltersV2 && filterType === 'inbound-filters' ? (
          <CustomFilters project={project} />
        ) : (
          <ProjectFiltersSettings project={project} params={params} />
        )}
      </div>
    </Fragment>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;

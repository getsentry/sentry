import {Link} from 'react-router';
import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import GroupTombstones from 'app/views/settings/project/projectFilters/groupTombstones';
import NavTabs from 'app/components/navTabs';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import ProjectFiltersChart from 'app/views/settings/project/projectFilters/projectFiltersChart';
import ProjectFiltersSettings from 'app/views/settings/project/projectFilters/projectFiltersSettings';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import recreateRoute from 'app/utils/recreateRoute';
import withProject from 'app/utils/withProject';
import {Project} from 'app/types';

type Props = {
  project: Project;
} & RouteComponentProps<{projectId: string; orgId: string; filterType: string}, {}>;

class ProjectFilters extends React.Component<Props> {
  render() {
    const {project, params} = this.props;
    const {orgId, projectId, filterType} = params;
    if (!project) {
      return null;
    }

    const features = new Set(project.features);

    return (
      <React.Fragment>
        <SentryDocumentTitle title={t('Inbound Filters')} objSlug={projectId} />
        <SettingsPageHeader title={t('Inbound Data Filters')} />
        <PermissionAlert />

        <TextBlock>
          {t(
            'Filters allow you to prevent Sentry from storing events in certain situations. Filtered events are tracked separately from rate limits, and do not apply to any project quotas.'
          )}
        </TextBlock>

        <div>
          <ProjectFiltersChart project={project} params={this.props.params} />

          {features.has('discard-groups') && (
            <NavTabs underlined style={{paddingTop: '30px'}}>
              <li className={filterType === 'data-filters' ? 'active' : ''}>
                <Link to={recreateRoute('data-filters/', {...this.props, stepBack: -1})}>
                  {t('Data Filters')}
                </Link>
              </li>
              <li className={filterType === 'discarded-groups' ? 'active' : ''}>
                <Link
                  to={recreateRoute('discarded-groups/', {...this.props, stepBack: -1})}
                >
                  {t('Discarded Issues')}
                </Link>
              </li>
            </NavTabs>
          )}

          {filterType === 'discarded-groups' ? (
            <GroupTombstones orgId={orgId} projectId={project.slug} />
          ) : (
            <ProjectFiltersSettings
              project={project}
              params={this.props.params}
              features={features}
            />
          )}
        </div>
      </React.Fragment>
    );
  }
}

export default withProject(ProjectFilters);

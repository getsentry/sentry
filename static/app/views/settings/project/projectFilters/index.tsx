import {Component, Fragment} from 'react';
import {Link, RouteComponentProps} from 'react-router';

import NavTabs from 'app/components/navTabs';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {Project} from 'app/types';
import recreateRoute from 'app/utils/recreateRoute';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import GroupTombstones from 'app/views/settings/project/projectFilters/groupTombstones';
import ProjectFiltersChart from 'app/views/settings/project/projectFilters/projectFiltersChart';
import ProjectFiltersSettings from 'app/views/settings/project/projectFilters/projectFiltersSettings';

type Props = {
  project: Project;
} & RouteComponentProps<{projectId: string; orgId: string; filterType: string}, {}>;

class ProjectFilters extends Component<Props> {
  render() {
    const {project, params, location} = this.props;
    const {orgId, projectId, filterType} = params;
    if (!project) {
      return null;
    }

    const features = new Set(project.features);

    return (
      <Fragment>
        <SentryDocumentTitle title={t('Inbound Filters')} projectSlug={projectId} />
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
            <GroupTombstones orgId={orgId} projectId={project.slug} location={location} />
          ) : (
            <ProjectFiltersSettings
              project={project}
              params={this.props.params}
              features={features}
            />
          )}
        </div>
      </Fragment>
    );
  }
}

export default ProjectFilters;

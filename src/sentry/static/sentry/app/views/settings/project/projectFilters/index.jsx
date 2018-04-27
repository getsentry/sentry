import {Link} from 'react-router';
import React from 'react';

import {t} from 'app/locale';
import GroupTombstones from 'app/views/settings/project/projectFilters/groupTombstones';
import ProjectFiltersChart from 'app/views/settings/project/projectFilters/projectFiltersChart';
import ProjectFiltersSettings from 'app/views/settings/project/projectFilters/projectFiltersSettings';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import recreateRoute from 'app/utils/recreateRoute';

class ProjectFilters extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  render() {
    let {organization, project} = this.context;
    let {orgId, projectId, filterType} = this.props.params;
    if (!project) return null;

    let features = new Set(project.features);

    return (
      <div>
        <SettingsPageHeader title={t('Inbound Data Filters')} />
        <TextBlock>
          {t(
            'Filters allow you to prevent Sentry from storing events in certain situations. Filtered events are tracked separately from rate limits, and do not apply to any project quotas.'
          )}
        </TextBlock>

        <div>
          <ProjectFiltersChart params={this.props.params} />

          {features.has('discard-groups') && (
            <ul
              className="nav nav-tabs"
              style={{borderBottom: '1px solid #ddd', paddingTop: '30px'}}
            >
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
            </ul>
          )}

          {filterType == 'discarded-groups' ? (
            <GroupTombstones orgId={orgId} projectId={projectId} />
          ) : (
            <ProjectFiltersSettings
              project={project}
              organization={organization}
              params={this.props.params}
              features={features}
            />
          )}
        </div>
      </div>
    );
  }
}

export default ProjectFilters;

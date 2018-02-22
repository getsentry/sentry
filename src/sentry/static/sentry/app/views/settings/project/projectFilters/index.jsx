import React from 'react';

import {t} from '../../../../locale';
import GroupTombstones from './groupTombstones';
import ProjectFiltersChart from './projectFiltersChart';
import ProjectFiltersSettings from './projectFiltersSettings';
import SentryTypes from '../../../../proptypes';
import SettingsPageHeader from '../../components/settingsPageHeader';
import TextBlock from '../../components/text/textBlock';

class ProjectFilters extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      activeSection: 'data-filters',
    };
  }

  setProjectNavSection = section => {
    this.setState({
      activeSection: section,
    });
  };

  render() {
    let {organization, project} = this.context;
    let {orgId, projectId} = this.props.params;
    let {activeSection} = this.state;
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
              <li className={activeSection === 'data-filters' ? 'active' : ''}>
                <a onClick={() => this.setProjectNavSection('data-filters')}>
                  {t('Data Filters')}
                </a>
              </li>
              <li className={activeSection === 'discarded-groups' ? 'active' : ''}>
                <a onClick={() => this.setProjectNavSection('discarded-groups')}>
                  {t('Discarded Issues')}
                </a>
              </li>
            </ul>
          )}

          {activeSection == 'data-filters' ? (
            <ProjectFiltersSettings
              project={project}
              organization={organization}
              params={this.props.params}
              features={features}
            />
          ) : (
            <GroupTombstones
              orgId={orgId}
              projectId={projectId}
              tombstones={this.state.tombstones}
              tombstoneError={this.state.tombstoneError}
              fetchData={this.fetchData}
            />
          )}
        </div>
      </div>
    );
  }
}

export default ProjectFilters;

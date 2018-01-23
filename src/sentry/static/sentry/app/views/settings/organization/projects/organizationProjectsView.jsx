import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {loadStats} from '../../../../actionCreators/projects';
import {t} from '../../../../locale';
import ApiMixin from '../../../../mixins/apiMixin';
import OrganizationSettingsView from '../../../organizationSettingsView';
import ProjectListItem from './components/projectListItem';
import ProjectsStore from '../../../../stores/projectsStore';
import SentryTypes from '../../../../proptypes';
import SpreadLayout from '../../../../components/spreadLayout';

class OrganizationProjectsView extends OrganizationSettingsView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Projects`;
  }

  renderBody() {
    let {projects} = this.props;

    return (
      <div>
        <SpreadLayout className="page-header">
          <h3>{t('Projects')}</h3>
        </SpreadLayout>

        <table className="table table-no-top-border m-b-0">
          <tbody>
            {projects
              .sort(({isBookmarked}) => (isBookmarked ? -1 : 1))
              .map((project, i) => (
                <ProjectListItem
                  key={i}
                  project={project}
                  organization={this.context.organization}
                />
              ))}
          </tbody>
        </table>
      </div>
    );
  }
}

// reflux :(
const OrganizationProjectsViewContainer = createReactClass({
  displayName: 'OrganizationProjectsViewContainer',
  mixins: [ApiMixin, Reflux.listenTo(ProjectsStore, 'onProjectUpdate')],

  getInitialState() {
    return {
      projects: Array.from(ProjectsStore.getAll().values()),
    };
  },

  componentDidMount() {
    loadStats(this.api, {
      orgId: this.props.params.orgId,
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'generated',
        group: 'project',
      },
    });
  },

  onProjectUpdate(projects) {
    // loadInitialData returns a list of ids
    this.setState({
      projects: Array.from(ProjectsStore.getAll().values()),
    });
  },

  render() {
    return <OrganizationProjectsView {...this.props} projects={this.state.projects} />;
  },
});

export default OrganizationProjectsViewContainer;

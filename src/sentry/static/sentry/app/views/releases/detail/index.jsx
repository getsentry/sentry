import PropTypes from 'prop-types';
import React from 'react';
import pick from 'lodash/pick';

import {PageContent} from 'app/styles/organization';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/sentryTypes';
import profiler from 'app/utils/profiler';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import ReleaseHeader from './releaseHeader';

const ReleaseDetailsContainer = props => {
  return (
    <React.Fragment>
      <GlobalSelectionHeader organization={props.organization} />
      <OrganizationReleaseDetails {...props} />
    </React.Fragment>
  );
};
ReleaseDetailsContainer.propTypes = {
  organization: SentryTypes.Organization,
};

class OrganizationReleaseDetails extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    /**
     * Currently selected values(s)
     */
    selection: SentryTypes.GlobalSelection,
    /**
     * List of projects to display in project selector
     */
    projects: PropTypes.arrayOf(SentryTypes.Project).isRequired,
  };

  static childContextTypes = {
    release: PropTypes.object,
  };

  getChildContext() {
    return {
      release: this.state.release,
    };
  }

  getTitle() {
    const {
      params: {version},
      organization,
    } = this.props;
    return `Release ${version} | ${organization.slug}`;
  }

  getEndpoints() {
    const {orgId, version} = this.props.params;
    const {project} = this.props.location.query;
    const query = {};
    if (project !== undefined) {
      query.project = project;
    }
    return [
      [
        'release',
        `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`,
        {query},
      ],
    ];
  }

  renderBody() {
    const {
      location,
      params: {orgId},
    } = this.props;
    const {release} = this.state;

    const query = pick(location.query, Object.values(URL_PARAM));

    if (this.state.loading) {
      return <LoadingIndicator />;
    }
    if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    return (
      <PageContent>
        <ReleaseHeader release={release} orgId={orgId} />
        {React.cloneElement(this.props.children, {
          release,
          query,
        })}
      </PageContent>
    );
  }

  renderError(error, disableLog = false, disableReport = false) {
    const has404Errors = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );
    if (has404Errors) {
      // This catches a 404 coming from the release endpoint and displays a custom error message.
      const {projects: all_projects} = this.props;
      const {projects: selected_projects} = this.props.selection;

      return (
        <PageContent>
          <Alert type="error" icon="icon-circle-exclamation">
            {t(
              'This release may not be in your selected project' +
                (selected_projects.length > 1 ? 's' : '')
            )}
            :{' '}
            {selected_projects
              .map(p => {
                return all_projects.find(pp => parseInt(pp.id, 10) === p).name;
              })
              .join(', ')}
          </Alert>
        </PageContent>
      );
    }
    return super.renderError(error, disableLog, disableReport);
  }
}

export default withProjects(
  withOrganization(withGlobalSelection(profiler()(ReleaseDetailsContainer)))
);

import PropTypes from 'prop-types';
import React from 'react';
import {pick} from 'lodash';

import SentryTypes from 'app/sentryTypes';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import AsyncView from 'app/views/asyncView';
import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';

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
    const fourOhFourErrors = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404 && resp.responseJSON && resp.responseJSON.detail
    );
    if (fourOhFourErrors) {
      // This catches a 404 coming from the release endpoint and displays a custom error message.
      return (
        <div className="alert alert-block alert-error" style={{margin: '30px 0 10px'}}>
          <div style={{fontSize: 24, marginBottom: 10}}>
            <span className="icon-exclamation" style={{fontSize: 20, marginRight: 10}} />
            <span>{t('Release Not Found')}</span>
          </div>
          <p>The release you are looking for was not found.</p>
          <p>You may wish to try the following:</p>
          <ul>
            <li>
              If you have just changed projects, it is possible that this release is not
              associated with any of your selected projects. If so, include a project that
              this release is associated with.
            </li>
            <li>
              If you entered the address manually, double check the path. Does the release
              ID look correct?
            </li>
            <li>
              If all else fails,{' '}
              <a href="http://github.com/getsentry/sentry/issues">create an issue</a> with
              more details.
            </li>
          </ul>
          <p>
            Not sure what to do? <a href="/">Return to the dashboard</a>
          </p>
        </div>
      );
    }
    return super.renderError(error, disableLog, disableReport);
  }
}

// export default withOrganization(ReleaseDetailsContainer);
export default withOrganization(withGlobalSelection(ReleaseDetailsContainer));

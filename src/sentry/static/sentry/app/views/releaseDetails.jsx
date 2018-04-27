import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Count from 'app/components/count';
import ExternalLink from 'app/components/externalLink';
import ListLink from 'app/components/listLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectState from 'app/mixins/projectState';
import ReleaseStats from 'app/components/releaseStats';
import SentryTypes from 'app/proptypes';
import TextOverflow from 'app/components/textOverflow';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';

const ReleaseDetails = createReactClass({
  displayName: 'ReleaseDetails',

  propTypes: {
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  },

  contextTypes: {
    location: PropTypes.object,
  },

  childContextTypes: {
    release: PropTypes.object,
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      release: null,
      loading: true,
      error: false,
    };
  },

  getChildContext() {
    return {
      release: this.state.release,
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (this.props.environment !== prevProps.environment) {
      this.fetchData();
    }
  },

  getTitle() {
    let project = this.getProject();
    let params = this.props.params;
    return 'Release ' + params.version + ' | ' + project.slug;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const {environment} = this.props;
    const query = environment ? {environment: environment.name} : {};

    this.api.request(this.getReleaseDetailsEndpoint(), {
      query,
      success: data => {
        this.setState({
          loading: false,
          release: data,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  getReleaseDetailsEndpoint() {
    let params = this.props.params;
    let orgId = params.orgId;
    let projectId = params.projectId;
    let version = params.version;

    return (
      '/projects/' +
      orgId +
      '/' +
      projectId +
      '/releases/' +
      encodeURIComponent(version) +
      '/'
    );
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let release = this.state.release;
    let {orgId, projectId} = this.props.params;
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="ref-release-details">
          <div className="release-details">
            <div className="row">
              <div className="col-sm-4 col-xs-12">
                <h3>
                  {t('Release')}{' '}
                  <strong>
                    <Version
                      orgId={orgId}
                      projectId={projectId}
                      version={release.version}
                      anchor={false}
                    />
                  </strong>
                </h3>
                {!!release.url && (
                  <div>
                    <ExternalLink href={release.url}>
                      <TextOverflow>{release.url}</TextOverflow>
                    </ExternalLink>
                  </div>
                )}
                <div className="release-meta">
                  <span className="icon icon-clock" />{' '}
                  <TimeSince date={release.dateCreated} />
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <ReleaseStats release={release} />
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">{t('New Issues')}</h6>
                  <span className="stream-count">
                    <Count value={release.newGroups} />
                  </span>
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">{t('First Event')}</h6>
                  {release.firstEvent ? (
                    <span className="stream-count">
                      <TimeSince date={release.firstEvent} />
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">{t('Last Event')}</h6>
                  {release.lastEvent ? (
                    <span className="stream-count">
                      <TimeSince date={release.lastEvent} />
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>
            <ul className="nav nav-tabs">
              <ListLink
                to={`/${orgId}/${projectId}/releases/${encodeURIComponent(
                  release.version
                )}/`}
                isActive={loc => {
                  // react-router isActive will return true for any route that is part of the active route
                  // e.g. parent routes. To avoid matching on sub-routes, insist on strict path equality.
                  return loc.pathname === this.props.location.pathname;
                }}
              >
                {t('Overview')}
              </ListLink>
              <ListLink
                to={`/${orgId}/${projectId}/releases/${encodeURIComponent(
                  release.version
                )}/new-events/`}
              >
                {t('New Issues')}
              </ListLink>
              <ListLink
                to={`/${orgId}/${projectId}/releases/${encodeURIComponent(
                  release.version
                )}/all-events/`}
              >
                {t('All Issues')}
              </ListLink>
              <ListLink
                to={`/${orgId}/${projectId}/releases/${encodeURIComponent(
                  release.version
                )}/artifacts/`}
              >
                {t('Artifacts')}
              </ListLink>
              <ListLink
                to={`/${orgId}/${projectId}/releases/${encodeURIComponent(
                  release.version
                )}/commits/`}
              >
                {t('Commits')}
              </ListLink>
            </ul>
          </div>
          {React.cloneElement(this.props.children, {
            release,
            environment: this.props.environment,
          })}
        </div>
      </DocumentTitle>
    );
  },
});

export default withEnvironmentInQueryString(ReleaseDetails);

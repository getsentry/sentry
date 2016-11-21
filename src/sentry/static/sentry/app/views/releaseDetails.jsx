import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import Count from '../components/count';
import DocumentTitle from 'react-document-title';
import ListLink from '../components/listLink';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import ProjectState from '../mixins/projectState';
import TimeSince from '../components/timeSince';
import Version from '../components/version';
import {t} from '../locale';

const ReleaseDetails = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  childContextTypes: {
    release: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    ProjectState
  ],

  getInitialState() {
    return {
      release: null,
      loading: true,
      error: false
    };
  },

  getChildContext() {
    return {
      release: this.state.release
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  getTitle() {
    let project = this.getProject();
    let team = this.getTeam();
    let params = this.props.params;
    return 'Release ' + params.version + ' | ' + team.name + ' / ' + project.name;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getReleaseDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          loading: false,
          release: data
        });
      }, error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  getReleaseDetailsEndpoint() {
    let params = this.props.params;
    let orgId = params.orgId;
    let projectId = params.projectId;
    let version = params.version;

    return '/projects/' + orgId + '/' + projectId + '/releases/' + encodeURIComponent(version) + '/';
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let release = this.state.release;

    let {orgId, projectId} = this.props.params;
    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <div className="release-details">
            <div className="row">
              <div className="col-sm-6 col-xs-12">
                <h3>{t('Release')} <strong><Version orgId={orgId} projectId={projectId} version={release.version} anchor={false} /></strong></h3>
                <div className="release-meta">
                  <span className="icon icon-clock"></span> <TimeSince date={release.dateCreated} />
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">{t('New Issues')}</h6>
                  <span className="stream-count"><Count value={release.newGroups} /></span>
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">{t('First Event')}</h6>
                  {release.firstEvent ?
                    <span className="stream-count"><TimeSince date={release.firstEvent} /></span>
                  :
                    <span>&mdash;</span>
                  }
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">{t('Last Event')}</h6>
                  {release.lastEvent ?
                    <span className="stream-count"><TimeSince date={release.lastEvent} /></span>
                  :
                    <span>&mdash;</span>
                  }
                </div>
              </div>
            </div>
            <ul className="nav nav-tabs">
              <ListLink to={`/${orgId}/${projectId}/releases/${encodeURIComponent(release.version)}/`} isActive={(loc) => {
                // react-router isActive will return true for any route that is part of the active route
                // e.g. parent routes. To avoid matching on sub-routes, insist on strict path equality.
                return loc.pathname === this.props.location.pathname;
              }}>{t('New Issues')}</ListLink>
              <ListLink to={`/${orgId}/${projectId}/releases/${encodeURIComponent(release.version)}/all-events/`}>{t('All Issues')}</ListLink>
              <ListLink to={`/${orgId}/${projectId}/releases/${encodeURIComponent(release.version)}/artifacts/`}>{t('Artifacts')}</ListLink>
            </ul>
          </div>
          {React.cloneElement(this.props.children, {
            release: release,
          })}
        </div>
      </DocumentTitle>
    );
  }
});

export default ReleaseDetails;

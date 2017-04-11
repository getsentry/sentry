import React from 'react';
import jQuery from 'jquery';
import {browserHistory} from 'react-router';

import ReleaseStats from '../../components/releaseStats';
import Count from '../../components/count';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';

import ApiMixin from '../../mixins/apiMixin';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import Pagination from '../../components/pagination';
import SearchBar from '../../components/searchBar.jsx';
import {t} from '../../locale';

const Releases = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    releaseList: React.PropTypes.array.isRequired
  },

  render() {
    let {orgId, projectId} = this.props;

    return (
      <ul className="list-group list-group-lg">
          {this.props.releaseList.map((release) => {
            return (
              <li className="list-group-item" key={release.version}>
                <div className="row row-center-vertically">
                  <div className="col-sm-4 col-xs-6">
                    <h2><Version orgId={orgId} projectId={projectId} version={release.version} /></h2>
                    <p className="m-b-0 text-light">
                      <span className="icon icon-clock"></span> <TimeSince date={release.dateCreated} />
                    </p>
                  </div>
                  <div className="col-sm-4 hidden-xs">
                    <ReleaseStats release={release}/>
                  </div>
                  <div className="col-sm-2 col-xs-3 text-big text-light">
                    <Count className="release-count" value={release.newGroups} />
                  </div>
                  <div className="col-sm-2 col-xs-3 text-light">
                    {release.lastEvent ?
                      <TimeSince date={release.lastEvent} />
                    :
                      <span>&mdash;</span>
                    }
                  </div>
                </div>
              </li>
            );
          })}
      </ul>
    );
  }
});


const ProjectReleaseList = React.createClass({
  propTypes: {
    defaultQuery: React.PropTypes.string,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      defaultQuery: ''
    };
  },

  getInitialState() {
    let queryParams = this.props.location.query;

    return {
      releaseList: [],
      loading: true,
      error: false,
      query: queryParams.query || this.props.defaultQuery,
      pageLinks: ''
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
      let queryParams = nextProps.location.query;
      this.setState({
        query: queryParams.query
      }, this.fetchData);
    }
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '')
      targetQueryParams.query = query;

    let {orgId, projectId} = this.props.params;
    browserHistory.pushState(null, `/${orgId}/${projectId}/releases/`, targetQueryParams);
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getProjectReleasesEndpoint(), {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          releaseList: data,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  getProjectReleasesEndpoint() {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      per_page: 20,
      query: this.state.query
    };

    return '/projects/' + params.orgId + '/' + params.projectId + '/releases/?' + jQuery.param(queryParams);
  },

  getReleaseTrackingUrl() {
    let params = this.props.params;

    return '/' + params.orgId + '/' + params.projectId + '/settings/release-tracking/';
  },

  renderStreamBody() {
    let body;

    let params = this.props.params;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.releaseList.length > 0)
      body = <Releases orgId={params.orgId} projectId={params.projectId} releaseList={this.state.releaseList} />;
    else if (this.state.query && this.state.query !== this.props.defaultQuery)
      body = this.renderNoQueryResults();
    else
      body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderNoQueryResults() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('Sorry, no releases match your filters.')}</p>
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There don\'t seem to be any releases yet.')}</p>
        <p><a href={this.getReleaseTrackingUrl()}>
          {t('Learn how to integrate Release Tracking')}
        </a></p>
      </div>
    );
  },

  render() {
    return (
      <div>
        <div className="row release-list-header">
          <div className="col-sm-7">
            <h3>{t('Releases')}</h3>
          </div>
          <div className="col-sm-5 release-search">
            <SearchBar defaultQuery=""
              placeholder={t('Search for a release.')}
              query={this.state.query}
              onSearch={this.onSearch}
            />
          </div>
        </div>
        <div className="panel panel-default">
          <div className="panel-heading panel-heading-bold">
            <div className="row">
              <div className="col-sm-8 col-xs-7">{t('Version')}</div>
              <div className="col-sm-2 col-xs-3">
                {t('New Issues')}
              </div>
              <div className="col-sm-2 col-xs-2">
                {t('Last Event')}
              </div>
            </div>
          </div>
          {this.renderStreamBody()}
        </div>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
});

export default ProjectReleaseList;

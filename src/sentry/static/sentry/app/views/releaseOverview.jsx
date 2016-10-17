import React from 'react';
import {History} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import TimeSince from '../components/timeSince';

import {t} from '../locale';
import {toTitleCase} from '../utils';

const ReleaseCommits = React.createClass({
  propTypes: {
    release: React.PropTypes.object,
  },

  mixins: [ApiMixin, History],

  getInitialState() {
    return {
      loading: true,
      error: false,
      commitList: [],
      pageLinks: null
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
     if (this.props.location.search !== prevProps.location.search) {
      this.fetchData();
    }
  },

  getEndpoint() {
    let {params, release} = this.props;
    return `/projects/${params.orgId}/${params.projectId}/releases/${release.version}/commits/`;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      method: 'GET',
      data: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          commitList: data,
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

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;
    else if (this.state.commitList.length === 0)
      return (
        <div className="box empty-stream">
          <span className="icon icon-exclamation"></span>
          <p>{t('There is no commit log associated with this release.')}</p>
        </div>
      );

    // TODO(dcramer): files should allow you to download them
    return (
      <div>
        <ul className="commit-list">
          {this.state.commitList.map((commit) => {
            return (
              <li key={commit.id}>
                <div className="pull-right">
                  <small>{commit.shortId}</small>
                </div>
                {commit.title &&
                  <div><strong>{commit.title}</strong></div>
                }
                <small>&mdash; by {commit.author ? commit.author.name : <em>unknown author</em>}</small>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
});

const ReleaseOverview = React.createClass({
  propTypes: {
    release: React.PropTypes.object,
  },

  render() {
    let {release} = this.props;
    return (
      <div className="row">
        <div className="col-md-8">
          <h4>Commit Log</h4>

          <ReleaseCommits {...this.props} />
        </div>
        <div className="col-md-4">
          <h4>Environments</h4>

          <dl className="flat">
            {release.environments.map((env) => {
              return [
                <dt key={`t-${env.id}`} style={{width: 120}}>{toTitleCase(env.name)}</dt>,
                <dd key={`d-${env.id}`}>
                  <TimeSince date={env.firstSeen} />
                </dd>
              ];
            })}
          </dl>
        </div>
      </div>
    );
  }
});

export default ReleaseOverview;

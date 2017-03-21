import React from 'react';

import LoadingIndicator from '../../components/loadingIndicator';
import LoadingError from '../../components/loadingError';
import Avatar from '../../components/avatar';
import TimeSince from '../../components/timeSince';

import ApiMixin from '../../mixins/apiMixin';

const ReleaseCommit = React.createClass({
  propTypes: {
    commitId: React.PropTypes.string,
    shortId: React.PropTypes.string,
    commitMessage: React.PropTypes.string,
    commitDateCreated: React.PropTypes.string,
    author: React.PropTypes.object,
    repository: React.PropTypes.object,

  },

  getCommitUrl() {
    if (this.props.repository.provider.id === 'github') {
      return this.props.repository.url + '/commit/' + this.props.commitId;
    }
  },

  render() {
    let commitUrl = this.getCommitUrl();
    return (
      <li className="list-group-item" key={this.props.commitId}>
        <div className="row row-center-vertically">
          <div className="col-xs-8 list-group-avatar">
            <Avatar user={this.props.author}/>
            <h5>{this.props.commitMessage}</h5>
            <p><strong>{this.props.author.name}</strong> committed <TimeSince date={this.props.commitDateCreated} /></p>
          </div>
          <div className="col-xs-2"><span className="repo-label">{this.props.repository.name}</span></div>
          <div className="col-xs-2 align-right">
            {commitUrl ?
              <a className="btn btn-default btn-sm"
                 href={commitUrl}
                 target="_blank"><span
                 className={'icon-mark-' + this.props.repository.provider.id}/>&nbsp; {this.props.shortId}</a> :
              <span>{this.props.shortId}</span>}
          </div>
        </div>
      </li>
    );
  }
});

const ReleaseCommits = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      commitList: []
    };
  },

  componentDidMount() {
    let {orgId, projectId, version} = this.props.params;

    let path = `/projects/${orgId}/${projectId}/releases/${version}/commits/`;
    this.api.request(path, {
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

  emptyState() {
    return(
      <div className="box empty-stream m-y-0">
        <span className="icon icon-exclamation" />
        <p>There are no commits associated with this release.</p>
        {/* Todo: Should we link to repo settings from here?  */}
      </div>
    );
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator/>;

    if (this.state.error)
      return <LoadingError/>;

    let {commitList} = this.state;

    if (!commitList.length)
      return <this.emptyState/>;

    return (
      <div className="panel panel-default">
        <div className="panel-heading panel-heading-bold">
          <div className="row">
            <div className="col-xs-8">
              Commit
            </div>
            <div className="col-xs-2">
              Repository
            </div>
            <div className="col-xs-2 align-right">
              SHA
            </div>
          </div>
        </div>
        <ul className="list-group list-group-lg commit-list">
          {commitList.map(commit => {
            let shortId = commit.id.slice(0, 7);
            return (
              <ReleaseCommit
                key={commit.id}
                commitId={commit.id}
                shortId={shortId}
                author={commit.author}
                commitMessage={commit.message}
                commitDateCreated={commit.dateCreated}
                repository={commit.repository}
                />
            );
          })}
        </ul>
      </div>
    );
  }
});

export default ReleaseCommits;

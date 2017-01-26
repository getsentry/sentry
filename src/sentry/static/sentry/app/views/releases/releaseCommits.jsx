import React from 'react';
import LoadingIndicator from '../../components/loadingIndicator';
import LoadingError from '../../components/loadingError';

import ApiMixin from '../../mixins/apiMixin';

const ReleaseCommit = React.createClass({
  propTypes: {
    commitId: React.PropTypes.string,
    shortId: React.PropTypes.string,
    commitMessage: React.PropTypes.string,
    commitDateCreated: React.PropTypes.string
  },
  render() {
    return (
      <li className="list-group-item" key={this.props.commitId}>
        <div className="row">
          <div className="col-sm-2 col-xs-2"><strong>{this.props.shortId}</strong></div>
          <div className="col-sm-7 col-xs-7">{this.props.commitMessage}</div>
          <div className="col-sm-3 col-xs-3 align-right actions">{this.props.commitDateCreated}</div>
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

  render() {
    if (this.state.loading)
      return <LoadingIndicator/>;

    if (this.state.error)
      return <LoadingError/>;

    let {commitList} = this.state;
    return (
      <div className="panel panel-default">
        <div className="panel-heading panel-heading-bold">
          <div className="row">
            <div className="col-sm-2 col-xs-2">{'SHA'}</div>
            <div className="col-sm-7 col-xs-7">{'Message'}</div>
            <div className="col-sm-3 col-xs-3 align-right">{'Date'}</div>
          </div>
        </div>
        <ul className="list-group commit-list">
          {commitList.map(commit => {
            let shortId = commit.id.slice(0, 7);
            return (
              <ReleaseCommit
                commitId={commit.id}
                shortId={shortId}
                commitMessage={commit.message}
                commitDateCreated={commit.dateCreated}
                />
            );
          })}
        </ul>
      </div>
    );
  }
});

export default ReleaseCommits;

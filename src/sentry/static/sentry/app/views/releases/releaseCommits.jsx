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
        <div className="row row-center-vertically">
          <div className="col-sm-8 list-group-avatar">
            <img src="https://github.com/benvinegar.png" className="avatar"/>
            <h5 className="m-b-0">{this.props.commitMessage}</h5>
            <p className="m-b-0"><strong>benvinegar</strong> committed {this.props.commitDateCreated}</p>
          </div>
          <div className="col-sm-2"><span className="badge">getsentry/sentry</span></div>
          <div className="col-sm-2 align-right">
            <a className="btn btn-default btn-sm"><span className="icon-mark-github"/>&nbsp; {this.props.shortId}</a>
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

            <div className="col-md-8">
              Commit
            </div>
            <div className="col-md-2">
              Repository
            </div>
            <div className="col-md-2 align-right">
              SHA
            </div>
          </div>
        </div>
        <ul className="list-group list-group-lg commit-list">
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

import React from 'react';
import LoadingIndicator from '../../components/loadingIndicator';

import ApiMixin from '../../mixins/apiMixin';

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
      return <div>fuuu</div>;

    let {commitList} = this.state;
    return (
      <div>
        <div className="release-group-header">
          <div className="row">
            <div className="col-sm-2 col-xs-2">{'SHA'}</div>
            <div className="col-sm-7 col-xs-7">{'Message'}</div>
            <div className="col-sm-3 col-xs-3 align-right">{'Date'}</div>
          </div>
        </div>
        <div className="release-list">
          {commitList.map(commit => {
            let shortId = commit.id.slice(0, 7);
            return (
              <div className="release release-artifact row" key={commit.id}>
                <div className="col-sm-2 col-xs-2"><strong>{shortId}</strong></div>
                <div className="col-sm-7 col-xs-7">{commit.message}</div>
                <div className="col-sm-3 col-xs-3 align-right actions">{commit.dateCreated}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
});

export default ReleaseCommits;

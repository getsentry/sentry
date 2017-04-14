import React from 'react';

import {ReleaseCommit} from '../views/releases/releaseCommits';

import ApiMixin from '../mixins/apiMixin';
import TimeSince from './timeSince';

const ReleaseUserCommits = React.createClass({
  propTypes: {
    release: React.PropTypes.object,
    userId: React.PropTypes.number,
    orgId: React.PropTypes.string,
  },

  mixins: [ApiMixin],

  getInitialState(){
    return ({commitList:[], loading: true});
  },

  componentDidMount(){

    let path = `/organizations/${this.props.orgId}/users/${this.props.userId}/releases/${this.props.release.version}/commits/`;

    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {

        this.setState({
          commitList: data,
          loading: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  render() {
    let {commitList, loading} = this.state;
    if(loading) {
      return null;
    }

    return (
      <div>
        <h4>Version {this.props.release.shortVersion} <small> released <TimeSince date={this.props.release.dateCreated}/> </small></h4>
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
              return (
                <ReleaseCommit
                  key={commit.id}
                  commitId={commit.id}
                  author={commit.author}
                  commitMessage={commit.message}
                  commitDateCreated={commit.dateCreated}
                  repository={commit.repository}
                  />
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
});

export default ReleaseUserCommits;
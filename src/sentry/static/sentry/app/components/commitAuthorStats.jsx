import React from 'react';

import LoadingIndicator from '../components/loadingIndicator';
import LoadingError from '../components/loadingError';
import Avatar from '../components/Avatar';

import TooltipMixin from '../mixins/tooltip';
import ApiMixin from '../mixins/apiMixin';

const CommitAuthorStats = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    version: React.PropTypes.string.isRequired,
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip'
    }),
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
    };
  },

  componentDidMount() {
    let {orgId, projectId, version} = this.props;
    let path = `/projects/${orgId}/${projectId}/releases/${version}/commits/`;
    this.api.request(path, {
      method: 'GET',
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

    let commitAuthors = {};

    for (let i = 0; i < commitList.length; i++) {
      if (!commitAuthors[commitList[i].author.email]) {
        commitAuthors[commitList[i].author.email] = {
          commit: 1,
          author: commitList[i].author
        };
      }
      else {
        commitAuthors[commitList[i].author.email].commit += 1;
      }
    }

    let authors = Object.keys(commitAuthors);
    return (
      <div className="col-sm-3">
        Commits by Author
        {authors.map(author => {
          if (!author) {
            return null;
          }
          return (<div className="avatar-grid">
                    <span className="avatar-grid-item tip"
                         title={commitAuthors[author].author.name + ' ' + commitAuthors[author].author.email}>
                      <Avatar user={commitAuthors[author].author}/>
                    </span>
                    <span  className="col-sm-2">{commitAuthors[author].commit} commits</span>
                  </div>);
          }
        )}
      </div>
    );
  }
});

export default CommitAuthorStats;
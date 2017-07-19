import React from 'react';

import LoadingIndicator from '../components/loadingIndicator';
import LoadingError from '../components/loadingError';
import Avatar from '../components/avatar';

import TooltipMixin from '../mixins/tooltip';
import ApiMixin from '../mixins/apiMixin';

import {t} from '../locale';

const CommitBar = React.createClass({
  propTypes: {
    totalCommits: React.PropTypes.number.isRequired,
    authorCommits: React.PropTypes.number.isRequired
  },

  render() {
    let barStyle = {};
    barStyle.width = this.props.authorCommits / this.props.totalCommits * 100 + '%';

    return <div className="commit-bar" style={barStyle} />;
  }
});

const CommitAuthorStats = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    version: React.PropTypes.string.isRequired
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip'
    })
  ],

  getInitialState() {
    return {
      loading: true,
      error: false
    };
  },

  componentDidMount() {
    let {orgId, projectId, version} = this.props;
    let path = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/commits/`;
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

  componentDidUpdate(prevProps, prevState) {
    if (prevState.loading && !this.state.loading) {
      this.removeTooltips();
      this.attachTooltips();
    }
  },

  renderEmpty() {
    return <div className="box empty">{t('No authors in this release')}</div>;
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;

    if (this.state.error) return <LoadingError />;

    let {commitList} = this.state;

    let commitAuthors = commitList.reduce((_commitAuthors, commit) => {
      let {author} = commit;
      if (!_commitAuthors.hasOwnProperty(author.email)) {
        _commitAuthors[author.email] = {
          commitCount: 1,
          author: author
        };
      } else {
        _commitAuthors[author.email].commitCount += 1;
      }
      return _commitAuthors;
    }, {});

    let commitAuthorValues = Object.values(commitAuthors);

    // sort commitAuthors by highest commitCount to lowest commitCount
    commitAuthorValues.sort((a, b) => {
      return b.commitCount - a.commitCount;
    });

    return (
      <div style={{marginTop: 5}}>
        <h6 className="nav-header m-b-1">Commits by Author</h6>
        {!commitAuthorValues.length && this.renderEmpty()}
        <ul className="list-group">
          {commitAuthorValues.map((commitAuthor, i) => {
            let {author, commitCount} = commitAuthor;
            return (
              <li
                key={i}
                className="list-group-item list-group-item-sm list-group-avatar">
                <div className="row row-flex row-center-vertically">
                  <div className="col-sm-8">
                    <span
                      className="avatar-grid-item m-b-0 tip"
                      title={author.name + ' ' + author.email}>
                      <Avatar user={author} size={32} />
                    </span>
                    <CommitBar
                      totalCommits={commitList.length}
                      authorCommits={commitCount}
                    />
                  </div>
                  <div className="col-sm-4 align-right">
                    {commitCount}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
});

export default CommitAuthorStats;

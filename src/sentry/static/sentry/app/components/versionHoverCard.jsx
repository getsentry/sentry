import React from 'react';
import _ from 'underscore';

import Avatar from './avatar';

import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';
import TimeSince from './timeSince';

import {getShortVersion} from '../utils';
import {t} from '../locale';

import ApiMixin from '../mixins/apiMixin';

const VersionHoverCard = React.createClass({
  propTypes: {
    version: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: {},
      visible: false,
      hasRepos: false,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId, version} = this.props;
    let done = _.after(2, () => {
      this.setState({loading: false});
    });

    // releases
    let releasePath = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/`;
    this.api.request(releasePath, {
      method: 'GET',
      success: (data) => {
        this.setState({
          release: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
      complete: done
    });

    // repos
    let repoPath = `/organizations/${orgId}/repos/`;
    this.api.request(repoPath, {
      method: 'GET',
      success: (data) => {
        this.setState({
          hasRepos: data.length > 0,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
      complete: done
    });
  },

  toggleHovercard () {
    this.setState({
      visible: !this.state.visible,
    });
  },

  renderRepoLink() {
    let {orgId} = this.props;
    return (
      <div className="version-hovercard blankslate m-a-0 p-x-1 p-y-1 align-center">
        <h5>Releases are better with commit data!</h5>
        <p>Connect a repository to see commit info, files changed, and authors involved in future releases.</p>
        <a className="btn btn-primary"
          href={`/organizations/${orgId}/repos/`}>
          Connect a repository
        </a>
      </div>
    );
  },

  renderMessage(message) {
    if (!message) {
      return t('No message provided');
    }

    if (message.length > 100) {
      let truncated = message.substr(0, 90);
      let words = truncated.split(' ');
      // try to not have elipsis mid-word
      if (words.length > 1) {
        words.pop();
        truncated = words.join(' ');
      }
      return truncated + '...';
    }
    return message;
  },

  renderBody() {
    let {release} = this.state;
    let {version} = this.props;

    let lastCommit = release.lastCommit;
    let commitAuthor = lastCommit && lastCommit.author;
    let shortVersion = getShortVersion(version);

    return (
      <div>
        <div className="hovercard-header">
          <span>Release {shortVersion}</span>
        </div>
        <div className="hovercard-body">
          {this.state.loading ? <LoadingIndicator mini={true}/> :
            (this.state.error ? <LoadingError /> :
              <div>
              <div className="row row-flex">
                <div className="col-xs-4">
                  <h6>New Issues</h6>
                  <div className="count">{release.newGroups}</div>
                </div>
                <div className="col-xs-8">
                  <h6>{release.commitCount} {release.commitCount !== 1 ? t('commits ') : t('commit ')} {t('by ')} {release.authors.length} {release.authors.length !== 1 ? t('authors') : t('author')} </h6>
                  <div className="avatar-grid">
                    {release.authors.map((author, i) => {
                      return (
                        <span className="avatar-grid-item tip" key={i}
                             title={author.name + ' ' + author.email}>
                          <Avatar user={author}/>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              {lastCommit &&
                <div>
                  <h6 className="commit-heading">Last commit</h6>
                  <div className="commit">
                    <div className="commit-avatar">
                      <Avatar user={commitAuthor || {'username': '?'}}/>
                    </div>
                    <div className="commit-message">
                      {this.renderMessage(lastCommit.message)}
                    </div>
                    <div className="commit-meta">
                      <strong>{(commitAuthor && commitAuthor.name) || t('Unknown Author')}</strong>&nbsp;
                      <TimeSince date={lastCommit.dateCreated} />
                    </div>
                  </div>
                </div>}
            </div>
            )
          }
        </div>
    </div>
    );
  },

  render() {
    let {visible} = this.state;
    return (
      <span onMouseEnter={this.toggleHovercard} onMouseLeave={this.toggleHovercard}>
        {this.props.children}
        {visible &&
          <div className="hovercard" >
            <div className="hovercard-hoverlap" />
            {this.state.hasRepos ? this.renderBody() : this.renderRepoLink()}
          </div>
        }
      </span>
    );
  }
});

export default VersionHoverCard;

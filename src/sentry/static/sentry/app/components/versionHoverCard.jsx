import React from 'react';

import Avatar from './avatar';

import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';

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
    let {orgId, projectId, version} = this.props;

    let path = `/projects/${orgId}/${projectId}/releases/${version}/`;
    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          release: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      }
    });
    this.getRepos();
  },

  getRepos() {
    let {orgId} = this.props;
    let path = `/organizations/${orgId}/repos/`;
    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          hasRepos: data.length > 0,
          loading:false,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      }
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
      <div className="version-hovercard blankslate m-a-0 p-x-2 p-t-1 p-b-2 align-center">
        <h5>Releases are better with commit data!</h5>
        <p>Connect a repository to see commit info, files changed, and authors involved in future releases.</p>
        <a className="btn btn-primary"
          href={`/organizations/${orgId}/repos/`}>
          Connect a repository
        </a>
      </div>
    );
  },

  renderBody() {
    let {release} = this.state;

    return (
      <div className="hovercard-body">
        {this.state.loading ? <LoadingIndicator mini={true}/> :
          (this.state.error ? <LoadingError /> :
            <div className="row row-flex">
              <div className="col-xs-4">
                <h6>New Issues</h6>
                <div className="count">{release.newGroups}</div>
              </div>
              <div className="col-xs-8">
                <h6>{release.commitCount} {release.commitCount !== 1 ? t('commits ') : t('commit ')} {t('by ')} {release.authors.length} {release.authors.length !== 1 ? t('authors') : t('author')} </h6>
                <div className="avatar-grid">
                  {release.authors.map(author => {
                    return (
                      <span className="avatar-grid-item tip"
                           title={author.name + ' ' + author.email}>
                        <Avatar user={author}/>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        }
      </div>
    );
  },

  render() {
    let {version} = this.props;
    let shortVersion = getShortVersion(version);
    let {visible} = this.state;

    return (
      <span onMouseEnter={this.toggleHovercard} onMouseLeave={this.toggleHovercard}>
        {this.props.children}
        {visible &&
          <div className="hovercard" >
            <div className="hovercard-header">
              <span>Release {shortVersion}</span>
            </div>
            {this.state.hasRepos ? this.renderBody() : this.renderRepoLink()}
          </div>
        }
      </span>
    );
  }
});

export default VersionHoverCard;

import React from 'react';

import Avatar from './avatar';

import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';

import {getShortVersion} from '../utils';
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
    };
  },

  componentDidMount() {
    let {orgId, version} = this.props;

    let path = `/organizations/${orgId}/releases/${version}/`;
    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          release: data,
          loading: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
  },

  toggleHovercard () {
    this.setState({
      visible: !this.state.visible,
    });
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
                <h6>{release.commitCount} commits by {release.authors.length} authors</h6>
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
            {this.renderBody()}
          </div>
        }
      </span>
    );
  }
});

export default VersionHoverCard;

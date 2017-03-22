import React from 'react';

import Avatar from './avatar';

import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';

import ApiMixin from '../mixins/apiMixin';

const HoverCard = React.createClass({
  propTypes: {
    version: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    visible: React.PropTypes.bool.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: {},
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

  render() {

    let {version, visible} = this.props;
    let shortVersion = version.match(/^[a-f0-9]{40}$/) ? version.substr(0, 12) : version;
    let release = this.state.release;
    if (!visible) {
      return null;
    }

    if (this.state.error) {
      return(
        <div className="hovercard">
          <div className="hovercard-header">
            <span>Release {shortVersion}</span>
          </div>
          <LoadingError />
        </div>
      );
    }

    return (
      <div className="hovercard">
        <div className="hovercard-header">
          <span>Release {shortVersion}</span>
        </div>
        <div className="hovercard-body">
        {this.state.loading ? <LoadingIndicator mini={true}/> :
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
        }
        </div>
      </div>
    );
  }
});

export default HoverCard;

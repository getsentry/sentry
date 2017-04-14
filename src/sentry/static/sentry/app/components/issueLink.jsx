import React from 'react';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import Count from './count';
import GroupTitle from './group/title';
import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';
import TimeSince from './timeSince';

export default React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    issue: React.PropTypes.object.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null,
      visible: false,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {issue} = this.props;
    let path = `/issues/${issue.id}/`;
    this.api.request(path, {
      method: 'GET',
      success: (data) => {
        this.setState({
          loading: false,
          issue: data,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  toggleHovercard () {
    this.setState({
      visible: !this.state.visible,
    });
  },

  getMessage(data) {
    let metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return data.culprit || '';
    }
  },


  renderBody() {
    let {issue, orgId, projectId} = this.props;
    let message = this.getMessage(issue);

    let className = '';
    className += ' type-' + issue.type;
    className += ' level-' + issue.level;
    if (issue.isBookmarked) {
      className += ' isBookmarked';
    }
    if (issue.hasSeen) {
      className += ' hasSeen';
    }
    if (issue.status === 'resolved') {
      className += ' isResolved';
    }

    return (
      <div>
        <div className="hovercard-header">
          <span>{issue.shortId}</span>
        </div>
        <div className="hovercard-body">
          {this.state.loading ? <LoadingIndicator mini={true}/> :
            (this.state.error ? <LoadingError /> :
              <div className={className}>
                <div style={{marginBottom: 20}}>
                  <h3>
                    <GroupTitle data={issue} />
                  </h3>
                  <div className="event-message">
                    <span className="error-level">{issue.level}</span>
                    {message &&
                      <span className="message">{message}</span>
                    }
                    {issue.logger &&
                      <span className="event-annotation">
                        <Link to={{
                            pathname:`/${orgId}/${projectId}/`,
                            query: {query: 'logger:' + issue.logger}
                          }}>
                          {issue.logger}
                        </Link>
                      </span>
                    }
                    {issue.annotations.map((annotation, i) => {
                      return (
                        <span className="event-annotation" key={i}
                            dangerouslySetInnerHTML={{__html: annotation}} />
                      );
                    })}
                  </div>
                </div>
                <div className="row row-flex" style={{marginBottom: 20}}>
                  <div className="col-xs-6">
                    <h6>First Seen</h6>
                    <TimeSince date={issue.firstSeen} />
                  </div>
                  <div className="col-xs-6">
                    <h6>Last Seen</h6>
                    <TimeSince date={issue.lastSeen} />
                  </div>
                </div>
                <div className="row row-flex">
                  <div className="col-xs-6">
                    <h6>Occurances</h6>
                    <Count value={issue.count} />
                  </div>
                  <div className="col-xs-6">
                    <h6>Users Affected</h6>
                    <Count value={issue.userCount} />
                  </div>
                </div>
              </div>
            )
          }
        </div>
      </div>
    );
  },

  render() {
    let {issue, orgId, projectId} = this.props;
    let {visible} = this.state;
    return (
      <span onMouseEnter={this.toggleHovercard} onMouseLeave={this.toggleHovercard}
            style={{position: 'relative'}}>
        <Link to={`/${orgId}/${projectId}/issues/${issue.id}/`}>{this.props.children}</Link>
        {visible &&
          <div className="hovercard" >
            <div className="hovercard-hoverlap" />
            {this.renderBody()}
          </div>
        }
      </span>
    );
  },
});

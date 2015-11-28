import React from 'react';
import Reflux from 'reflux';
import {Link} from 'react-router';

import TimeSince from './timeSince';

import GroupStore from '../stores/groupStore';

const CompactIssue = React.createClass({
  propTypes: {
    id: React.PropTypes.string.isRequired,
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange')
  ],

  getInitialState() {
    return {
      data: GroupStore.get(this.props.id)
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        data: GroupStore.get(this.props.id)
      });
    }
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    let id = this.props.id;
    let data = GroupStore.get(id);
    this.setState({
      data: data,
    });
  },

  render() {
    let data = this.state.data;

    let className = 'group row';
    if (data.isBookmarked) {
      className += ' isBookmarked';
    }
    if (data.hasSeen) {
      className += ' hasSeen';
    }
    if (data.status === 'resolved') {
      className += ' isResolved';
    }
    if (data.status === 'muted') {
      className += ' isMuted';
    }

    className += ' level-' + data.level;

    let {id, orgId} = this.props;
    let projectId = data.project.slug;

    return (
      <div className={className} onClick={this.toggleSelect}>
        <div className="col-md-7 col-xs-8 event-details">
          <h3 className="truncate">
            <Link to={`/${orgId}/${projectId}/issues/${data.id}/`}>
              <span className="error-level truncate">{data.level}</span>
              <span className="icon icon-soundoff"></span>
              <span className="icon icon-bookmark"></span>
              {data.title}
            </Link>
          </h3>
          <div className="event-message truncate">
            <span className="message">{data.culprit}</span>
          </div>
          <div className="event-extra">
            <ul>
              <li>
                <span className="icon icon-clock"></span>
                <TimeSince date={data.lastSeen} />
                &nbsp;&mdash;&nbsp;
                <TimeSince date={data.firstSeen} suffix="old" />
              </li>
              {data.numComments !== 0 &&
                <li>
                  <Link to={`/${orgId}/${projectId}/issues/${id}/activity/`} className="comments">
                    <span className="icon icon-comments"></span>
                    <span className="tag-count">{data.numComments}</span>
                  </Link>
                </li>
              }
              {data.logger &&
                <li className="event-annotation">
                  <Link to={`/${orgId}/${projectId}/`} query={{query: 'logger:' + data.logger}}>
                    {data.logger}
                  </Link>
                </li>
              }
              {data.annotations.map((annotation, key) => {
                return (
                  <li className="event-annotation"
                      dangerouslySetInnerHTML={{__html: annotation}}
                      key={key} />
                );
              })}
            </ul>
          </div>
        </div>
        <div className="event-assignee col-md-1 hidden-sm hidden-xs">

        </div>
      </div>
    );
  }
});

export default CompactIssue;

import React from 'react';
import Reflux from 'reflux';
import {Link} from 'react-router';

import TimeSince from './timeSince';
import DropdownLink from './dropdownLink';

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

    let className = 'issue row';
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

    let title = <span className="icon-more"></span>;

    return (
      <li className={className} onClick={this.toggleSelect}>
        <div className="col-md-10">
          <span className="error-level truncate" title={data.level}></span>
          <h3 className="truncate">
            <Link to={`/${orgId}/${projectId}/issues/${data.id}/`}>
              <span className="icon icon-soundoff hidden"></span>
              <span className="icon icon-bookmark hidden"></span>
              {data.title}
            </Link>
          </h3>
          <div className="event-extra">
            <ul>
              <li className="project-name"><a href="">Project Name</a></li>
              <li className="hidden">
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
              <li className="culprit">{data.culprit}</li>
            </ul>
          </div>
        </div>
        <div className="col-md-2 align-right">
          <DropdownLink
            topLevelClasses="more-menu"
            className="more-menu-toggle"
            caret={false}
            onOpen={this.onDropdownOpen}
            onClose={this.onDropdownClose}
            title={title}>
            <li><a href="#"><span className="icon-checkmark"></span></a></li>
            <li><a href="#"><span className="icon-bookmark"></span></a></li>
            <li><a href="#">zZz</a></li>
            <li><a href="#">Hi</a></li>
          </DropdownLink>
        </div>
      </li>
    );
  }
});

export default CompactIssue;

import jQuery from 'jquery';
import React from 'react';
import Reflux from 'reflux';
import {Link} from 'react-router';

import AssigneeSelector from '../assigneeSelector';
import Count from '../count';
import GroupChart from './groupChart';
import GroupCheckBox from './groupCheckBox';
import ProjectState from '../../mixins/projectState';
import TimeSince from '../timeSince';
import GroupTitle from '../group/title';
import GroupStore from '../../stores/groupStore';
import SelectedGroupStore from '../../stores/selectedGroupStore';
import ShortId from '../shortId';

import {valueIsEqual} from '../../utils';

const StreamGroupHeader = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
  },

  getMessage() {
    let data = this.props.data;
    let metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return this.props.data.culprit || '';
    }
  },

  render() {
    let {orgId, projectId, data} = this.props;
    let message = this.getMessage();
    return (
      <div>
        <h3 className="truncate">
          <Link to={`/${orgId}/${projectId}/issues/${data.id}/`}>
            <span className="error-level truncate">{data.level}</span>
            <span className="icon icon-soundoff" />
            <span className="icon icon-star-solid" />
            <GroupTitle data={data} />
          </Link>
        </h3>
        {message &&
          <div className="event-message truncate">
            <span className="message">{this.getMessage()}</span>
          </div>
        }
      </div>
    );
  }
});

const StreamGroup = React.createClass({
  propTypes: {
    id: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    statsPeriod: React.PropTypes.string.isRequired,
    canSelect: React.PropTypes.bool
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange'),
    ProjectState
  ],

  getDefaultProps() {
    return {
      canSelect: true,
      id: '',
      statsPeriod: '24h'
    };
  },

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

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.statsPeriod !== this.props.statsPeriod) {
      return true;
    }
    if (!valueIsEqual(this.state.data, nextState.data)) {
      return true;
    }
    return false;
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

  toggleSelect(evt) {
    if (evt.target.tagName === 'A')
      return;
    if (evt.target.tagName === 'INPUT')
      return;
    if (jQuery(evt.target).parents('a').length !== 0)
      return;

    SelectedGroupStore.toggleSelect(this.state.data.id);
  },

  render() {
    let data = this.state.data;
    let userCount = data.userCount;

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
    if (data.status === 'ignored') {
      className += ' isIgnored';
    }

    className += ' type-' + data.type;
    className += ' level-' + data.level;

    let {id, orgId, projectId} = this.props;

    return (
      <li className={className} onClick={this.toggleSelect}>
        <div className="col-md-7 col-xs-8 event-details">
          {this.props.canSelect &&
            <div className="checkbox">
              <GroupCheckBox id={data.id} />
            </div>
          }
          <StreamGroupHeader
            orgId={orgId}
            projectId={projectId}
            data={data} />
          <div className="event-extra">
            <ul>
              {this.getFeatures().has('callsigns') && data.shortId &&
                <li>
                  <ShortId shortId={data.shortId} />
                </li>
              }
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
                  <Link to={{pathname: `/${orgId}/${projectId}/`, query: {query: 'logger:' + data.logger}}}>
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
          <AssigneeSelector id={data.id} />
        </div>
        <div className="col-md-2 hidden-sm hidden-xs event-graph align-right">
          <GroupChart id={data.id} statsPeriod={this.props.statsPeriod} data={data}/>
        </div>
        <div className="col-md-1 col-xs-2 event-count align-right">
          <Count value={data.count} />
        </div>
        <div className="col-md-1 col-xs-2 event-users align-right">
          <Count value={userCount} />
        </div>
      </li>
    );
  }
});

export default StreamGroup;

import jQuery from "jquery";
import React from "react";
import Reflux from "reflux";
import Router from "react-router";
import AssigneeSelector from "./assigneeSelector";
import Count from "./count";
import GroupChart from "./streamGroupChart";
import GroupStore from "../stores/groupStore";
import SelectedGroupStore from "../stores/selectedGroupStore";
import TimeSince from "./timeSince";
import {compareArrays, valueIsEqual} from "../utils";

var GroupCheckBox = React.createClass({
  mixins: [
    Reflux.listenTo(SelectedGroupStore, "onSelectedGroupChange")
  ],

  propTypes: {
    id: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      isSelected: SelectedGroupStore.isSelected(this.props.id)
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        isSelected: SelectedGroupStore.isSelected(nextProps.id)
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (nextState.isSelected !== this.state.isSelected);
  },

  onSelectedGroupChange() {
    var isSelected = SelectedGroupStore.isSelected(this.props.id);
    if (isSelected !== this.state.isSelected) {
      this.setState({
        isSelected: isSelected,
      });
    }
  },

  onSelect() {
    var id = this.props.id;
    SelectedGroupStore.toggleSelect(id);
  },

  render() {
    return (
      <input type="checkbox" className="chk-select" value={this.props.id}
             checked={this.state.isSelected}
             onChange={this.onSelect} />
    );
  }
});

var StreamGroup = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    Reflux.listenTo(GroupStore, "onGroupChange")
  ],

  propTypes: {
    id: React.PropTypes.string.isRequired,
    statsPeriod: React.PropTypes.string.isRequired,
    canSelect: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      canSelect: true,
      id: "",
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
    var id = this.props.id;
    var data = GroupStore.get(id);
    this.setState({
      data: data,
    });
  },

  toggleSelect(event) {
    if (event.target.tagName === 'A')
      return;
    if (event.target.tagName === 'INPUT')
      return;
    if (jQuery(event.target).parents('a').length !== 0)
      return;

    SelectedGroupStore.toggleSelect(this.state.data.id);
  },

  render() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var data = this.state.data;
    var userCount = 0;

    if (data.tags["sentry:user"] !== undefined) {
      userCount = data.tags["sentry:user"].count;
    }

    var className = "group row";
    if (data.isBookmarked) {
      className += " isBookmarked";
    }
    if (data.hasSeen) {
      className += " hasSeen";
    }
    if (data.status === "resolved") {
      className += " isResolved";
    }
    if (data.status === "muted") {
      className += " isMuted";
    }

    var routeParams = {
      orgId: params.orgId,
      projectId: params.projectId,
      groupId: data.id
    };

    return (
      <li className={className} onClick={this.toggleSelect}>
        <div className="col-md-6 col-xs-8 event-details">
          {this.props.canSelect &&
            <div className="checkbox">
              <GroupCheckBox id={data.id} />
            </div>
          }
          <h3 className="truncate">
            <Router.Link to="groupDetails" params={routeParams}>
              <span className="icon icon-soundoff"></span>
              <span className="icon icon-bookmark"></span>
              {data.title}
            </Router.Link>
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
                  <Router.Link to="groupActivity" params={routeParams} className="comments">
                    <span className="icon icon-comments"></span>
                    <span className="tag-count">{data.numComments}</span>
                  </Router.Link>
                </li>
              }
              {data.logger &&
                <li className="event-annotation">
                  <Router.Link to="stream" params={params} query={{query: "logger:" + data.logger}}>
                    {data.logger}
                  </Router.Link>
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
        <div className="event-priority col-md-1 hidden-sm hidden-xs align-right">
          <span className={"level-" + data.level} title={"level-" + data.level}>
            <span className="icon-triangle"/>
          </span>
        </div>
        <div className="event-assignee col-md-1 hidden-sm hidden-xs">
          <AssigneeSelector id={data.id} />
        </div>
        <div className="col-md-2 hidden-sm hidden-xs event-graph align-right">
          <GroupChart id={data.id} statsPeriod={this.props.statsPeriod} />
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

import jQuery from "jquery";
import React from "react";
import Reflux from "reflux";
import Router from "react-router";

import AssigneeSelector from "../assigneeSelector";
import Count from "../count";
import GroupChart from "./groupChart";
import GroupCheckBox from "./groupCheckBox";
import TimeSince from "../timeSince";

import GroupStore from "../../stores/groupStore";
import SelectedGroupStore from "../../stores/selectedGroupStore";

import {valueIsEqual} from "../../utils";

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
    var router = this.context.router;
    var params = router.getCurrentParams();
    var data = this.state.data;
    var userCount = data.userCount;

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

    className += " level-" + data.level;

    var routeParams = {
      orgId: params.orgId,
      projectId: params.projectId,
      groupId: data.id
    };

    return (
      <li className={className} onClick={this.toggleSelect}>
        <div className="col-md-7 col-xs-8 event-details">
          {this.props.canSelect &&
            <div className="checkbox">
              <GroupCheckBox id={data.id} />
            </div>
          }
          <h3 className="truncate">
            <Router.Link to="groupDetails" params={routeParams}>
              <span className="error-level truncate">{data.level}</span>
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

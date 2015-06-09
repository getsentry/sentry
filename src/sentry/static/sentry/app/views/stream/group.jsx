/*** @jsx React.DOM */
var jQuery = require("jquery");
var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var AssigneeSelector = require("../../components/assigneeSelector");
var Count = require("../../components/count");
var GroupChart = require("./groupChart");
var GroupStore = require("../../stores/groupStore");
var SelectedGroupStore = require("../../stores/selectedGroupStore");
var TimeSince = require("../../components/timeSince");
var {compareArrays, valueIsEqual} = require("../../utils");

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

  componentDidMount() {
    var el = this.refs.element;
    if (!el) return;
    jQuery(el.getDOMNode()).click((event) => {
      if (event.target.tagName === 'A')
        return;
      if (event.target.tagName === 'INPUT')
        return;
      if (jQuery(event.target).parents('a').length !== 0)
        return;
      SelectedGroupStore.toggleSelect(this.state.data.id);
    });
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

    return (
      <li className={className} ref="element">
        <div className="col-md-6 event-details">
          <div className="checkbox">
            <GroupCheckBox id={data.id} />
          </div>
          <h3 className="truncate">
            <Router.Link to="groupDetails"
                  params={{orgId: params.orgId, projectId: params.projectId, groupId: data.id}}>
              <span className="icon icon-bookmark"></span>
              {data.title}
            </Router.Link>
          </h3>
          <div className="event-message">
            <span className="message">{data.culprit}</span>
          </div>
          <div className="event-meta">
            <span className="last-seen"><TimeSince date={data.lastSeen} /></span>
            &nbsp;&mdash;&nbsp;
            <span className="first-seen">from <TimeSince date={data.firstSeen} /></span>
          </div>
        </div>
        <div className="severity col-md-1 col-sm-1 hidden-xs">
          <span className="severity-indicator-bg">
            <span className="severity-indicator"></span>
          </span>
        </div>
        <div className="event-assignee col-md-1 hidden-xs hidden-sm">
          <AssigneeSelector id={data.id} />
        </div>
        <div className="col-md-2 hidden-sm hidden-xs event-graph align-right">
          <GroupChart id={data.id} statsPeriod={this.props.statsPeriod} />
        </div>
        <div className="col-md-1 hidden-xs event-occurrences align-right">
          <Count value={data.count} />
        </div>
        <div className="col-md-1 hidden-xs event-users align-right">
          <Count value={userCount} />
        </div>
      </li>
    );
  }
});

module.exports = StreamGroup;

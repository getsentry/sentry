var React = require("react");
var Router = require("react-router");

var api = require("../../api");
var AssigneeSelector = require("../../components/assigneeSelector");
var Count = require("../../components/count");
var GroupActions = require("./actions");
var GroupSeenBy = require("./seenBy");
var IndicatorStore = require("../../stores/indicatorStore");
var ListLink = require("../../components/listLink");
var ProjectState = require("../../mixins/projectState");
var PropTypes = require("../../proptypes");

var GroupHeader = React.createClass({
  mixins: [ProjectState],

  contextTypes: {
    router: React.PropTypes.func.isRequired
  },

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired
  },

  componentWillMount() {
    this.setState({
      activityCount: this.props.group.activity.length
    });
  },

  componentWillReceiveProps(nextProps) {
    this.setState({
      activityCount: nextProps.group.activity.length
    });
  },

  onToggleMute() {
    var group = this.props.group;
    var project = this.getProject();
    var org = this.getOrganization();
    var loadingIndicator = IndicatorStore.add('Saving changes..');

    api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        status: group.status === 'muted' ? 'unresolved' : 'muted'
      }
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  onShare() {
    alert(this.props.group.shareId);
  },

  onTogglePublic() {
    var group = this.props.group;
    var project = this.getProject();
    var org = this.getOrganization();
    var loadingIndicator = IndicatorStore.add('Saving changes..');

    api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        isPublic: !group.isPublic
      }
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    var group = this.props.group,
        userCount = 0;

    if (group.tags["sentry:user"] !== undefined) {
      userCount = group.tags["sentry:user"].count;
    }

    var className = "group-detail";
    if (group.isBookmarked) {
      className += " isBookmarked";
    }
    if (group.hasSeen) {
      className += " hasSeen";
    }
    if (group.status === "resolved") {
      className += " isResolved";
    }

    var groupRouteParams = this.context.router.getCurrentParams();

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-8 details">
            <h3>
              {group.title}
            </h3>
            <div className="event-message">
              <span className="message">{group.culprit}</span>
            </div>
          </div>
          <div className="col-sm-4 stats">
            <div className="row">
              <div className="col-xs-4 assigned-to">
                <AssigneeSelector id={group.id} />
                <div className="is-assigned"><span className="hidden-sm">is</span> assigned</div>
              </div>
              <div className="col-xs-4 count align-right">
                <Count value={group.count} />
                <span className="count-label">events</span>
              </div>
              <div className="col-xs-4 count align-right">
                <Count value={userCount} />
                <span className="count-label">users</span>
              </div>
            </div>
          </div>
        </div>
        <GroupSeenBy />
        <GroupActions />
        <div className="pull-right">
          <div className={(group.status === 'muted' ? 'on ' : '') + 'group-notifications'}>
            <a onClick={this.onToggleMute}>
              <span className="icon" />
              {group.status !== 'muted' ?
                'Turn notifications off'
              :
                'Turn notifications on'
              }
            </a>
          </div>
          <div className="group-privacy">
            <a onClick={this.onShare}>
              <span className="icon" /> Share this event
            </a>
          </div>
        </div>
        <ul className="nav nav-tabs">
          <ListLink to="groupOverview" params={groupRouteParams}>
            Overview
          </ListLink>
          <ListLink to="groupEvents" params={groupRouteParams}>
            Events
          </ListLink>
          <ListLink to="groupActivity" params={groupRouteParams}>
            Activity <span className="badge animated">{this.state.activityCount}</span>
          </ListLink>
          <ListLink to="groupTags" params={groupRouteParams}>
            Tags
          </ListLink>
        </ul>
      </div>
    );
  }
});

module.exports = GroupHeader;

/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../../api");
var GroupState = require("../../mixins/groupState");
var LinkWithConfirmation = require("../../components/linkWithConfirmation");

var GroupActions = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [GroupState],

  onDelete() {
    var group = this.getGroup();
    var project = this.getProject();
    var org = this.getOrganization();

    api.bulkDelete({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id]
    });

    this.context.router.transitionTo('stream', {
      orgId: org.slug,
      projectId: project.slug
    });
  },

  onToggleResolve() {
    var group = this.getGroup();
    var project = this.getProject();
    var org = this.getOrganization();

    api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        status: group.status === 'resolved' ? 'unresolved' : 'resolved'
      }
    });
  },

  onToggleBookmark() {
    var group = this.getGroup();
    var project = this.getProject();
    var org = this.getOrganization();

    api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        isBookmarked: !group.isBookmarked
      }
    });
  },

  render() {
    var group = this.getGroup();

    var resolveClassName = "group-resolve btn btn-default btn-sm";
    if (group.status === "resolved") {
      resolveClassName += " active";
    }

    var bookmarkClassName = "group-bookmark btn btn-default btn-sm";
    if (group.isBookmarked) {
      bookmarkClassName += " active";
    }

    return (
      <div className="group-actions">
        <div className="btn-group">
          <a className={resolveClassName}
             onClick={this.onToggleResolve}>
            <span className="icon-checkmark"></span>
          </a>
          <a className={bookmarkClassName}
             onClick={this.onToggleBookmark}>
            <span className="icon-bookmark"></span>
          </a>
        </div>
        <div className="btn-group">
          <LinkWithConfirmation
               className="group-remove btn btn-default btn-sm"
               message="Deleting this event is permanent. Are you sure you wish to continue?"
               onConfirm={this.onDelete}>
            <span className="icon-trash"></span>
          </LinkWithConfirmation>
        </div>
        <div className="btn-group more">
          <a href="#" className="btn btn-default btn-sm dropdown-toggle">More <span className="icon-arrow-down"></span></a>
          <ul className="dropdown-menu">
          </ul>
        </div>
        <div className="severity">
          <span className="severity-indicator-bg">
            <span className="severity-indicator"></span>
          </span>
        </div>
      </div>
    );
  }
});

module.exports = GroupActions;

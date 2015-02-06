/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var GroupState = require("../../mixins/groupState");

var GroupActions = React.createClass({
  mixins: [GroupState],

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
          <a href="#" className="group-remove btn btn-default btn-sm"
             data-action="remove"><span className="icon-trash"></span></a>
        </div>
        <div className="btn-group more">
          <a href="#" className="btn btn-default btn-sm dropdown-toggle">More <span className="icon-arrow-down"></span></a>
          <ul className="dropdown-menu">
          </ul>
        </div>
      </div>
    );
  }
});

module.exports = GroupActions;

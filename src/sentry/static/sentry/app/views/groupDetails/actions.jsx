import React from "react";
import Router from "react-router";
import api from "../../api";
import DropdownLink from "../../components/dropdownLink";
import GroupState from "../../mixins/groupState";
import IndicatorStore from "../../stores/indicatorStore";
import MenuItem from "../../components/menuItem";
import LinkWithConfirmation from "../../components/linkWithConfirmation";

var GroupActions = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [GroupState],

  onDelete() {
    var group = this.getGroup();
    var project = this.getProject();
    var org = this.getOrganization();
    var loadingIndicator = IndicatorStore.add('Delete event..');

    api.bulkDelete({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id]
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
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
    var loadingIndicator = IndicatorStore.add('Saving changes..');

    api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        status: group.status === 'resolved' ? 'unresolved' : 'resolved'
      }
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  onToggleBookmark() {
    var group = this.getGroup();
    var project = this.getProject();
    var org = this.getOrganization();
    var loadingIndicator = IndicatorStore.add('Saving changes..');

    api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        isBookmarked: !group.isBookmarked
      }
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
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
             title="Resolve"
             onClick={this.onToggleResolve}>
            <span className="icon-checkmark"></span>
          </a>
          <a className={bookmarkClassName}
             title="Bookmark"
             onClick={this.onToggleBookmark}>
            <span className="icon-bookmark"></span>
          </a>
        </div>
        <div className="btn-group">
          <LinkWithConfirmation
               className="group-remove btn btn-default btn-sm"
               title="Delete"
               message="Deleting this event is permanent. Are you sure you wish to continue?"
               onConfirm={this.onDelete}>
            <span className="icon-trash"></span>
          </LinkWithConfirmation>
        </div>
        {group.pluginActions.length !== 0 &&
          <div className="btn-group more">
            <DropdownLink
                className="btn btn-default btn-sm"
                title="More">
              {group.pluginActions.map((action, actionIdx) => {
                return (
                  <MenuItem key={actionIdx} href={action[1]}>
                    {action[0]}
                  </MenuItem>
                );
              })}
            </DropdownLink>
          </div>
        }
      </div>
    );
  }
});

export default GroupActions;


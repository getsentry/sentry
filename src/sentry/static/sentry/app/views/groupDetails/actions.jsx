import React from "react";
import {History} from "react-router";
import api from "../../api";
import DropdownLink from "../../components/dropdownLink";
import GroupState from "../../mixins/groupState";
import IndicatorStore from "../../stores/indicatorStore";
import MenuItem from "../../components/menuItem";
import LinkWithConfirmation from "../../components/linkWithConfirmation";

const GroupActions = React.createClass({
  mixins: [
    GroupState,
    History
  ],

  onDelete() {
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add('Delete event..');

    api.bulkDelete({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id]
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });

    this.history.pushState(null, `/${org.slug}/${project.slug}/`);
  },

  onToggleResolve() {
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add('Saving changes..');

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
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add('Saving changes..');

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
    let group = this.getGroup();

    let resolveClassName = "group-resolve btn btn-default btn-sm";
    if (group.status === "resolved") {
      resolveClassName += " active";
    }

    let bookmarkClassName = "group-bookmark btn btn-default btn-sm";
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

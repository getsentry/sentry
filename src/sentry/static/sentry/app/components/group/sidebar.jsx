import React from "react";
import GroupChart from "./chart";
import GroupState from "../../mixins/groupState";
import SeenInfo from "./seenInfo";
import TagDistributionMeter from "./tagDistributionMeter";

var GroupSidebar = React.createClass({
  mixins: [GroupState],

  render(){
    var orgId = this.getOrganization().slug;
    var projectId = this.getProject().slug;
    var group = this.getGroup();
    var tagList = [];
    for (var key in group.tags) {
      tagList.push([group.tags[key].name, key]);
    }
    tagList.sort();

    return (
      <div className="group-stats">
        <GroupChart statsPeriod="24h" group={group}
                    title="Last 24 Hours"
                    firstSeen={group.firstSeen}
                    lastSeen={group.lastSeen} />
        <GroupChart statsPeriod="30d" group={group}
                    title="Last 30 Days"
                    className="bar-chart-small"
                    firstSeen={group.firstSeen}
                    lastSeen={group.lastSeen} />

        <h6 className="first-seen"><span>First seen</span></h6>
        <SeenInfo
            orgId={orgId}
            projectId={projectId}
            date={group.firstSeen}
            release={group.firstRelease} />

        <h6 className="last-seen"><span>Last seen</span></h6>
        <SeenInfo
            orgId={orgId}
            projectId={projectId}
            date={group.lastSeen}
            release={group.lastRelease} />

        <h6><span>Tags</span></h6>
        {tagList.map((data) => {
          return (
            <TagDistributionMeter
              key={data[0]}
              group={group}
              name={data[0]}
              tag={data[1]} />
          );
        })}
      </div>
    );
  }
});

export default GroupSidebar;

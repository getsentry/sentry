import React from 'react';
import GroupChart from './chart';
import GroupState from '../../mixins/groupState';
import SeenInfo from './seenInfo';
import TagDistributionMeter from './tagDistributionMeter';
import {t} from '../../locale';

const GroupSidebar = React.createClass({
  mixins: [GroupState],

  render(){
    let orgId = this.getOrganization().slug;
    let projectId = this.getProject().slug;
    let group = this.getGroup();

    return (
      <div className="group-stats">
        <GroupChart statsPeriod="24h" group={group}
                    title={t('Last 24 Hours')}
                    firstSeen={group.firstSeen}
                    lastSeen={group.lastSeen} />
        <GroupChart statsPeriod="30d" group={group}
                    title={t('Last 30 Days')}
                    className="bar-chart-small"
                    firstSeen={group.firstSeen}
                    lastSeen={group.lastSeen} />

        <h6 className="first-seen"><span>{t('First seen')}</span></h6>
        <SeenInfo
            orgId={orgId}
            projectId={projectId}
            date={group.firstSeen}
            release={group.firstRelease} />

        <h6 className="last-seen"><span>{t('Last seen')}</span></h6>
        <SeenInfo
            orgId={orgId}
            projectId={projectId}
            date={group.lastSeen}
            release={group.lastRelease} />

        <h6><span>{t('Tags')}</span></h6>
        {group.tags.map((data) => {
          return (
            <TagDistributionMeter
              key={data.key}
              orgId={orgId}
              projectId={projectId}
              group={group}
              name={data.name}
              tag={data.key} />
          );
        })}
      </div>
    );
  }
});

export default GroupSidebar;

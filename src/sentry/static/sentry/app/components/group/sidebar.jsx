import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import Avatar from '../avatar';
import GroupChart from './chart';
import GroupState from '../../mixins/groupState';
import IndicatorStore from '../../stores/indicatorStore';
import SeenInfo from './seenInfo';
import TagDistributionMeter from './tagDistributionMeter';
import {t} from '../../locale';

const GroupParticipants = React.createClass({
  propTypes: {
    participants: React.PropTypes.array,
  },

  render() {
    let participants = this.props.participants;

    return (
      <div>
        <h6><span>{participants.length} Participants</span></h6>
        <ul className="faces">
          {participants.map((user) => {
            return (
              <li>
                <Avatar size={32} user={user} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});

const GroupSidebar = React.createClass({
  propTypes: {
    group: React.PropTypes.object,
  },

  mixins: [
    ApiMixin,
    GroupState
  ],

  getInitialState() {
    return {
      participants: this.props.group.participants
    };
  },

  toggleSubscription() {
    let group = this.props.group;
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        isSubscribed: !group.isSubscribed
      }
    }, {
      complete: () => {
        this.api.request(`/issues/${group.id}/participants/`, {
          success: (data) => {
            this.setState({participants: data});
            IndicatorStore.remove(loadingIndicator);
          }
        });
      }
    });
  },

  render() {
    let orgId = this.getOrganization().slug;
    let projectId = this.getProject().slug;
    let group = this.getGroup();
    let participants = this.state.participants;

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
        {participants.length !== 0 &&
          <GroupParticipants participants={participants} />
        }

        <h6><span>{t('Notifications')}</span></h6>
        {group.isSubscribed ?
          <p className="help-block">{t('You\'re subscribed to this issue and will get notified when updates happen.')}</p>
        :
          <p className="help-block">{t('You\'re not subscribed in this issue.')}</p>
        }
        <a className={`btn btn-default btn-subscribe ${group.isSubscribed && 'subscribed'}`}
           onClick={this.toggleSubscription}>
          <span className="icon-signal" /> {group.isSubscribed ? t('Unsubscribe') : t('Subscribe')}
        </a>
      </div>
    );
  }
});

export default GroupSidebar;

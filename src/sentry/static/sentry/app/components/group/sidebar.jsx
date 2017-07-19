import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import SuggestedOwners from './suggestedOwners';
import GroupParticipants from './participants';
import GroupReleaseStats from './releaseStats';
import GroupState from '../../mixins/groupState';
import IndicatorStore from '../../stores/indicatorStore';
import TagDistributionMeter from './tagDistributionMeter';
import LoadingError from '../../components/loadingError';
import {t, tct} from '../../locale';

const GroupSidebar = React.createClass({
  propTypes: {
    group: React.PropTypes.object,
    event: React.PropTypes.object
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      participants: []
    };
  },

  componentWillMount() {
    let group = this.props.group;
    this.api.request(`/issues/${group.id}/participants/`, {
      success: data => {
        this.setState({
          participants: data,
          error: false
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      }
    });
  },

  subscriptionReasons: {
    commented: t("You're receiving updates because you have commented on this issue."),
    assigned: t("You're receiving updates because you were assigned to this issue."),
    bookmarked: t("You're receiving updates because you have bookmarked this issue."),
    changed_status: t(
      "You're receiving updates because you have changed the status of this issue."
    ),
    mentioned: t(
      "You're receiving updates because you have been mentioned in this issue."
    )
  },

  toggleSubscription() {
    let group = this.props.group;
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate(
      {
        orgId: org.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data: {
          isSubscribed: !group.isSubscribed
        }
      },
      {
        complete: () => {
          this.api.request(`/issues/${group.id}/participants/`, {
            success: data => {
              this.setState({
                participants: data,
                error: false
              });
              IndicatorStore.remove(loadingIndicator);
            },
            error: () => {
              this.setState({
                error: true
              });
              IndicatorStore.remove(loadingIndicator);
            }
          });
        }
      }
    );
  },

  renderPluginIssue() {
    let issues = [];
    (this.props.group.pluginIssues || []).forEach(plugin => {
      let issue = plugin.issue;
      if (issue) {
        issues.push(
          <dl key={plugin.slug}>
            <dt>{plugin.title + ': '}</dt>
            <dd><a href={issue.url}>{issue.label}</a></dd>
          </dl>
        );
      }
    });
    if (issues.length) {
      return (
        <div>
          <h6><span>{t('External Issues')}</span></h6>
          {issues}
        </div>
      );
    }
    return null;
  },

  getNotificationText() {
    let group = this.getGroup();

    if (group.isSubscribed) {
      let result = t(
        "You're receiving updates because you are subscribed to this issue."
      );
      if (group.subscriptionDetails) {
        let reason = group.subscriptionDetails.reason;
        if (this.subscriptionReasons.hasOwnProperty(reason)) {
          result = this.subscriptionReasons[reason];
        }
      } else {
        result = tct(
          "You're receiving updates because you are [link:subscribed to workflow notifications] for this project.",
          {
            link: <a href="/account/settings/notifications/" />
          }
        );
      }
      return result;
    } else {
      return t("You're not subscribed to this issue.");
    }
  },

  renderParticipantData() {
    let error = this.state.error;
    let participants = (this.state || {}).participants || [];

    if (!error) {
      return (
        participants.length !== 0 && <GroupParticipants participants={participants} />
      );
    } else {
      return (
        <LoadingError
          message={t('There was an error while trying to load participants.')}
        />
      );
    }
  },

  render() {
    let project = this.getProject();
    let projectId = project.slug;
    let orgId = this.getOrganization().slug;
    let defaultEnvironment = project.defaultEnvironment;
    let group = this.getGroup();

    return (
      <div className="group-stats">
        <SuggestedOwners event={this.props.event} />

        <GroupReleaseStats
          group={group}
          location={this.context.location}
          defaultEnvironment={defaultEnvironment}
        />

        {this.renderPluginIssue()}

        <h6><span>{t('Tags')}</span></h6>
        {group.tags.map(data => {
          return (
            <TagDistributionMeter
              key={data.key}
              orgId={orgId}
              projectId={projectId}
              group={group}
              name={data.name}
              tag={data.key}
            />
          );
        })}

        {this.renderParticipantData()}

        <h6><span>{t('Notifications')}</span></h6>
        <p className="help-block">{this.getNotificationText()}</p>
        <a
          className={`btn btn-default btn-subscribe ${group.isSubscribed && 'subscribed'}`}
          onClick={this.toggleSubscription}>
          <span className="icon-signal" />
          {' '}
          {group.isSubscribed ? t('Unsubscribe') : t('Subscribe')}
        </a>
      </div>
    );
  }
});

export default GroupSidebar;

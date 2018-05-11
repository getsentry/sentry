import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import createReactClass from 'create-react-class';
import classNames from 'classnames';

import SentryTypes from 'app/proptypes';
import ApiMixin from 'app/mixins/apiMixin';
import SuggestedOwners from 'app/components/group/suggestedOwners';
import GroupParticipants from 'app/components/group/participants';
import GroupReleaseStats from 'app/components/group/releaseStats';
import ProjectState from 'app/mixins/projectState';
import HookStore from 'app/stores/hookStore';
import IndicatorStore from 'app/stores/indicatorStore';
import TagDistributionMeter from 'app/components/group/tagDistributionMeter';
import LoadingError from 'app/components/loadingError';
import {t, tct} from 'app/locale';
import withEnvironment from 'app/utils/withEnvironment';

const GroupSidebar = createReactClass({
  displayName: 'GroupSidebar',

  propTypes: {
    group: PropTypes.object.isRequired,
    event: PropTypes.object,
    environment: SentryTypes.Environment,
  },

  contextTypes: {
    location: PropTypes.object,
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    // Allow injection via getsentry et all
    let hooks = HookStore.get('issue:secondary-column').map(cb => {
      return cb({
        params: this.props.params,
      });
    });

    return {
      participants: [],
      hooks,
    };
  },

  componentWillMount() {
    let {group} = this.props;
    this.api.request(`/issues/${group.id}/participants/`, {
      success: data => {
        this.setState({
          participants: data,
          error: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
    });
    // Fetch group data for all environments since the one passed in props is filtered for the selected environment
    // The charts rely on having all environment data as well as the data for the selected env
    this.api.request(`/issues/${group.id}/`, {
      success: data => {
        this.setState({
          allEnvironmentsGroupData: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
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
    ),
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
          isSubscribed: !group.isSubscribed,
        },
      },
      {
        complete: () => {
          this.api.request(`/issues/${group.id}/participants/`, {
            success: data => {
              this.setState({
                participants: data,
                error: false,
              });
              IndicatorStore.remove(loadingIndicator);
            },
            error: () => {
              this.setState({
                error: true,
              });
              IndicatorStore.remove(loadingIndicator);
            },
          });
        },
      }
    );
  },

  renderPluginIssue() {
    let issues = [];
    (this.props.group.pluginIssues || []).forEach(plugin => {
      let issue = plugin.issue;
      // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
      if (issue) {
        issues.push(
          <dl key={plugin.slug}>
            <dt>{`${plugin.shortName || plugin.name || plugin.title}: `}</dt>
            <dd>
              <a href={issue.url}>
                {_.isObject(issue.label) ? issue.label.id : issue.label}
              </a>
            </dd>
          </dl>
        );
      }
    });
    if (issues.length) {
      return (
        <div>
          <h6>
            <span>{t('External Issues')}</span>
          </h6>
          {issues}
        </div>
      );
    }
    return null;
  },

  canChangeSubscriptionState() {
    return !(this.props.group.subscriptionDetails || {disabled: false}).disabled;
  },

  getNotificationText() {
    let {group} = this.props;

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
            link: <a href="/account/settings/notifications/" />,
          }
        );
      }
      return result;
    } else {
      if (group.subscriptionDetails && group.subscriptionDetails.disabled) {
        return tct('You have [link:disabled workflow notifications] for this project.', {
          link: <a href="/account/settings/notifications/" />,
        });
      } else {
        return t("You're not subscribed to this issue.");
      }
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
    let {group} = this.props;
    let project = this.getProject();
    let projectId = project.slug;
    let orgId = this.getOrganization().slug;

    let subscribeBtnClass = classNames('btn btn-default btn-subscribe', {
      subscribed: group.isSubscribed,
    });

    return (
      <div className="group-stats">
        <SuggestedOwners event={this.props.event} />
        {this.state.allEnvironmentsGroupData && (
          <GroupReleaseStats group={this.state.allEnvironmentsGroupData} />
        )}

        {this.renderPluginIssue()}

        {this.state.hooks}

        <h6>
          <span>{t('Tags')}</span>
        </h6>
        {group.tags.map(data => {
          return (
            <TagDistributionMeter
              key={data.key}
              data-test-id="group-tag"
              orgId={orgId}
              projectId={projectId}
              group={group}
              name={data.name}
              tag={data.key}
            />
          );
        })}
        {group.tags.length === 0 && (
          <p data-test-id="no-tags">
            {this.props.environment
              ? tct('No tags found in the [env] environment', {
                  env: this.props.environment.displayName,
                })
              : t('No tags found')}
          </p>
        )}

        {this.renderParticipantData()}

        <h6>
          <span>{t('Notifications')}</span>
        </h6>
        <p className="help-block">{this.getNotificationText()}</p>
        {this.canChangeSubscriptionState() && (
          <a className={subscribeBtnClass} onClick={this.toggleSubscription}>
            <span className="icon-signal" />
            {group.isSubscribed ? t('Unsubscribe') : t('Subscribe')}
          </a>
        )}
      </div>
    );
  },
});

export {GroupSidebar};
export default withEnvironment(GroupSidebar);

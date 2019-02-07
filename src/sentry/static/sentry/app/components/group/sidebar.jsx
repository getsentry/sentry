import PropTypes from 'prop-types';
import React from 'react';
import {isEqual, pickBy, keyBy, isObject} from 'lodash';
import createReactClass from 'create-react-class';
import classNames from 'classnames';

import SentryTypes from 'app/sentryTypes';
import ApiMixin from 'app/mixins/apiMixin';
import SuggestedOwners from 'app/components/group/suggestedOwners';
import GroupParticipants from 'app/components/group/participants';
import GroupReleaseStats from 'app/components/group/releaseStats';
import OrganizationState from 'app/mixins/organizationState';
import IndicatorStore from 'app/stores/indicatorStore';
import TagDistributionMeter from 'app/components/group/tagDistributionMeter';
import LoadingError from 'app/components/loadingError';
import {t, tct} from 'app/locale';

import ExternalIssueList from 'app/components/group/externalIssuesList';

const GroupSidebar = createReactClass({
  displayName: 'GroupSidebar',

  propTypes: {
    project: SentryTypes.Project,
    group: SentryTypes.Group,
    event: SentryTypes.Event,
    environments: PropTypes.arrayOf(SentryTypes.Environment),
  },

  contextTypes: {
    location: PropTypes.object,
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {participants: [], environments: this.props.environments};
  },

  componentWillMount() {
    const {group} = this.props;
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

    this.fetchTagData();
  },

  componentWillReceiveProps(nextProps) {
    if (!isEqual(nextProps.environments, this.props.environments)) {
      this.setState({environments: nextProps.environments}, this.fetchTagData);
    }
  },

  fetchTagData() {
    const {group} = this.props;

    // Fetch the top values for the current group's top tags.
    this.api.request(`/issues/${group.id}/tags/`, {
      query: pickBy({
        key: group.tags.map(data => data.key),
        environment: this.state.environments.map(env => env.name),
        enable_snuba: this.getFeatures().has('sentry10') ? '1' : '0',
      }),
      success: data => {
        this.setState({
          tagsWithTopValues: keyBy(data, 'key'),
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
    const {group, project} = this.props;
    const org = this.getOrganization();
    const loadingIndicator = IndicatorStore.add(t('Saving changes..'));

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
    const issues = [];
    (this.props.group.pluginIssues || []).forEach(plugin => {
      const issue = plugin.issue;
      // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
      if (issue) {
        issues.push(
          <dl key={plugin.slug}>
            <dt>{`${plugin.shortName || plugin.name || plugin.title}: `}</dt>
            <dd>
              <a href={issue.url}>
                {isObject(issue.label) ? issue.label.id : issue.label}
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
    const {group} = this.props;

    if (group.isSubscribed) {
      let result = t(
        "You're receiving updates because you are subscribed to this issue."
      );
      if (group.subscriptionDetails) {
        const reason = group.subscriptionDetails.reason;
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
    const error = this.state.error;
    const participants = (this.state || {}).participants || [];

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
    const {group, project} = this.props;
    const projectId = project.slug;
    const organization = this.getOrganization();

    const subscribeBtnClass = classNames('btn btn-default btn-subscribe', {
      subscribed: group.isSubscribed,
    });

    return (
      <div className="group-stats">
        <SuggestedOwners project={project} group={group} event={this.props.event} />
        <GroupReleaseStats
          group={this.props.group}
          project={project}
          allEnvironments={this.state.allEnvironmentsGroupData}
        />
        <ExternalIssueList
          group={this.props.group}
          project={project}
          orgId={organization.slug}
        />

        {this.renderPluginIssue()}

        <h6>
          <span>{t('Tags')}</span>
        </h6>
        {this.state.tagsWithTopValues &&
          group.tags.map(tag => {
            const tagWithTopValues = this.state.tagsWithTopValues[tag.key];
            const topValues = tagWithTopValues ? tagWithTopValues.topValues : [];
            const topValuesTotal = tagWithTopValues ? tagWithTopValues.totalValues : 0;
            return (
              <TagDistributionMeter
                key={tag.key}
                tag={tag.key}
                totalValues={tag.totalValues || topValuesTotal}
                topValues={topValues}
                name={tag.name}
                data-test-id="group-tag"
                organization={organization}
                projectId={projectId}
                group={group}
              />
            );
          })}
        {group.tags.length === 0 && (
          <p data-test-id="no-tags">
            {this.props.environments.length
              ? t('No tags found in the selected environments')
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

export default GroupSidebar;

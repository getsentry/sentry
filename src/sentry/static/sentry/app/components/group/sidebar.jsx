import PropTypes from 'prop-types';
import React from 'react';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import keyBy from 'lodash/keyBy';
import pickBy from 'lodash/pickBy';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import ErrorBoundary from 'app/components/errorBoundary';
import ExternalIssueList from 'app/components/group/externalIssuesList';
import GroupParticipants from 'app/components/group/participants';
import GroupReleaseStats from 'app/components/group/releaseStats';
import GroupTagDistributionMeter from 'app/components/group/tagDistributionMeter';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import LoadingError from 'app/components/loadingError';
import SentryTypes from 'app/sentryTypes';
import SubscribeButton from 'app/components/subscribeButton';
import SuggestedOwners from 'app/components/group/suggestedOwners/suggestedOwners';
import withApi from 'app/utils/withApi';

const SUBSCRIPTION_REASONS = {
  commented: t("You're receiving updates because you have commented on this issue."),
  assigned: t("You're receiving updates because you were assigned to this issue."),
  bookmarked: t("You're receiving updates because you have bookmarked this issue."),
  changed_status: t(
    "You're receiving updates because you have changed the status of this issue."
  ),
  mentioned: t("You're receiving updates because you have been mentioned in this issue."),
};

class GroupSidebar extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    group: SentryTypes.Group,
    event: SentryTypes.Event,
    environments: PropTypes.arrayOf(SentryTypes.Environment),
  };

  constructor(props) {
    super(props);

    this.state = {
      participants: [],
      environments: props.environments,
    };
  }

  UNSAFE_componentWillMount() {
    const {group, api} = this.props;
    api.request(`/issues/${group.id}/participants/`, {
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
    this.props.api.request(`/issues/${group.id}/`, {
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
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!isEqual(nextProps.environments, this.props.environments)) {
      this.setState({environments: nextProps.environments}, this.fetchTagData);
    }
  }

  fetchTagData() {
    const {api, group} = this.props;

    // Fetch the top values for the current group's top tags.
    api.request(`/issues/${group.id}/tags/`, {
      query: pickBy({
        key: group.tags.map(data => data.key),
        environment: this.state.environments.map(env => env.name),
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
  }

  toggleSubscription() {
    const {api, group, project, organization} = this.props;
    addLoadingMessage(t('Saving changes..'));

    api.bulkUpdate(
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data: {
          isSubscribed: !group.isSubscribed,
        },
      },
      {
        complete: () => {
          api.request(`/issues/${group.id}/participants/`, {
            success: data => {
              this.setState({
                participants: data,
                error: false,
              });
              clearIndicators();
            },
            error: () => {
              this.setState({
                error: true,
              });
              clearIndicators();
            },
          });
        },
      }
    );
  }

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
  }

  canChangeSubscriptionState() {
    return !(this.props.group.subscriptionDetails || {disabled: false}).disabled;
  }

  getNotificationText() {
    const {group} = this.props;

    if (group.isSubscribed) {
      let result = t(
        "You're receiving updates because you are subscribed to this issue."
      );
      if (group.subscriptionDetails) {
        const reason = group.subscriptionDetails.reason;
        if (SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
          result = SUBSCRIPTION_REASONS[reason];
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
  }

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
  }

  render() {
    const {group, organization, project, environments} = this.props;
    const projectId = project.slug;

    return (
      <div className="group-stats">
        <SuggestedOwners project={project} group={group} event={this.props.event} />
        <GroupReleaseStats
          group={this.props.group}
          project={project}
          environments={environments}
          organization={organization}
          allEnvironments={this.state.allEnvironmentsGroupData}
        />

        <ErrorBoundary mini>
          <ExternalIssueList
            event={this.props.event}
            group={this.props.group}
            project={project}
          />
        </ErrorBoundary>

        {this.renderPluginIssue()}

        <h6>
          <GuideAnchor target="tags" position="bottom">
            <span>{t('Tags')}</span>
          </GuideAnchor>
        </h6>
        {this.state.tagsWithTopValues &&
          group.tags.map(tag => {
            const tagWithTopValues = this.state.tagsWithTopValues[tag.key];
            const topValues = tagWithTopValues ? tagWithTopValues.topValues : [];
            const topValuesTotal = tagWithTopValues ? tagWithTopValues.totalValues : 0;

            return (
              <GroupTagDistributionMeter
                key={tag.key}
                tag={tag.key}
                totalValues={topValuesTotal}
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
          <SubscribeButton
            isSubscribed={group.isSubscribed}
            onClick={() => this.toggleSubscription()}
          />
        )}
      </div>
    );
  }
}

export default withApi(GroupSidebar);

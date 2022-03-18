import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Query} from 'history';

import {bulkDelete, bulkUpdate} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openReprocessEventModal} from 'sentry/actionCreators/modal';
import GroupActions from 'sentry/actions/groupActions';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import ActionButton from 'sentry/components/actions/button';
import IgnoreActions from 'sentry/components/actions/ignore';
import ResolveActions from 'sentry/components/actions/resolve';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Tooltip from 'sentry/components/tooltip';
import {IconStar} from 'sentry/icons';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Group,
  Organization,
  Project,
  ResolutionStatus,
  SavedQueryVersions,
  UpdateResolutionStatus,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {displayReprocessEventAction} from 'sentry/utils/displayReprocessEventAction';
import {uniqueId} from 'sentry/utils/guid';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import ReviewAction from 'sentry/views/issueList/actions/reviewAction';
import ShareIssue from 'sentry/views/organizationGroupDetails/actions/shareIssue';

import DeleteAction from './deleteAction';
import SubscribeAction from './subscribeAction';

type Props = {
  api: Client;
  disabled: boolean;
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
  query?: Query;
};

type State = {
  shareBusy: boolean;
};

class Actions extends React.Component<Props, State> {
  state: State = {
    shareBusy: false,
  };

  componentWillReceiveProps(nextProps: Props) {
    if (this.state.shareBusy && nextProps.group.shareId !== this.props.group.shareId) {
      this.setState({shareBusy: false});
    }
  }

  getShareUrl(shareId: string) {
    if (!shareId) {
      return '';
    }

    const path = `/share/issue/${shareId}/`;
    const {host, protocol} = window.location;
    return `${protocol}//${host}${path}`;
  }

  getDiscoverUrl() {
    const {group, project, organization} = this.props;
    const {title, id, type} = group;

    const discoverQuery = {
      id: undefined,
      name: title || type,
      fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
      orderby: '-timestamp',
      query: `issue.id:${id}`,
      projects: [Number(project.id)],
      version: 2 as SavedQueryVersions,
      range: '90d',
    };

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(organization.slug);
  }

  trackIssueAction(
    action:
      | 'shared'
      | 'deleted'
      | 'bookmarked'
      | 'subscribed'
      | 'mark_reviewed'
      | 'discarded'
      | ResolutionStatus
  ) {
    const {group, project, organization, query = {}} = this.props;
    trackAdvancedAnalyticsEvent('issue_details.action_clicked', {
      organization,
      project_id: project.id,
      group_id: group.id,
      action_type: action,
      // Alert properties track if the user came from email/slack alerts
      alert_date: typeof query.alert_date === 'string' ? query.alert_date : undefined,
      alert_rule_id:
        typeof query.alert_rule_id === 'string' ? query.alert_rule_id : undefined,
      alert_type: typeof query.alert_type === 'string' ? query.alert_type : undefined,
    });
  }

  onDelete = () => {
    const {group, project, organization, api} = this.props;

    addLoadingMessage(t('Delete event\u2026'));

    bulkDelete(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
      },
      {
        complete: () => {
          clearIndicators();

          browserHistory.push(`/${organization.slug}/${project.slug}/`);
        },
      }
    );

    this.trackIssueAction('deleted');
  };

  onUpdate = (
    data:
      | {isBookmarked: boolean}
      | {isSubscribed: boolean}
      | {inbox: boolean}
      | UpdateResolutionStatus
  ) => {
    const {group, project, organization, api} = this.props;

    addLoadingMessage(t('Saving changes\u2026'));

    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data,
      },
      {
        complete: clearIndicators,
      }
    );

    if ((data as UpdateResolutionStatus).status) {
      this.trackIssueAction((data as UpdateResolutionStatus).status);
    }
    if ((data as {inbox: boolean}).inbox !== undefined) {
      this.trackIssueAction('mark_reviewed');
    }
  };

  onReprocessEvent = () => {
    const {group, organization} = this.props;
    openReprocessEventModal({organization, groupId: group.id});
  };

  onShare(shared: boolean) {
    const {group, project, organization, api} = this.props;
    this.setState({shareBusy: true});

    // not sure why this is a bulkUpdate
    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data: {
          isPublic: shared,
        },
      },
      {
        error: () => {
          addErrorMessage(t('Error sharing'));
        },
        complete: () => {
          // shareBusy marked false in componentWillReceiveProps to sync
          // busy state update with shareId update
        },
      }
    );

    this.trackIssueAction('shared');
  }

  onToggleShare = () => {
    const newIsPublic = !this.props.group.isPublic;
    if (newIsPublic) {
      trackAdvancedAnalyticsEvent('issue.shared_publicly', {
        organization: this.props.organization,
      });
    }
    this.onShare(newIsPublic);
  };

  onToggleBookmark = () => {
    this.onUpdate({isBookmarked: !this.props.group.isBookmarked});
    this.trackIssueAction('bookmarked');
  };

  onToggleSubscribe = () => {
    this.onUpdate({isSubscribed: !this.props.group.isSubscribed});
    this.trackIssueAction('subscribed');
  };

  onDiscard = () => {
    const {group, project, organization, api} = this.props;
    const id = uniqueId();
    addLoadingMessage(t('Discarding event\u2026'));

    GroupActions.discard(id, group.id);

    api.request(`/issues/${group.id}/`, {
      method: 'PUT',
      data: {discard: true},
      success: response => {
        GroupActions.discardSuccess(id, group.id, response);
        browserHistory.push(`/${organization.slug}/${project.slug}/`);
      },
      error: error => {
        GroupActions.discardError(id, group.id, error);
      },
      complete: clearIndicators,
    });
    this.trackIssueAction('discarded');
  };

  handleClick(disabled: boolean, onClick: (event: React.MouseEvent) => void) {
    return function (event: React.MouseEvent) {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onClick(event);
    };
  }

  render() {
    const {group, project, organization, disabled, event} = this.props;
    const {status, isBookmarked} = group;

    const orgFeatures = new Set(organization.features);

    const bookmarkTitle = isBookmarked ? t('Remove bookmark') : t('Bookmark');
    const hasRelease = !!project.features?.includes('releases');

    const isResolved = status === 'resolved';
    const isIgnored = status === 'ignored';

    return (
      <Wrapper>
        <GuideAnchor target="resolve" position="bottom" offset={space(3)}>
          <ResolveActions
            disabled={disabled}
            disableDropdown={disabled}
            hasRelease={hasRelease}
            latestRelease={project.latestRelease}
            onUpdate={this.onUpdate}
            orgSlug={organization.slug}
            projectSlug={project.slug}
            isResolved={isResolved}
            isAutoResolved={
              group.status === 'resolved' ? group.statusDetails.autoResolved : undefined
            }
          />
        </GuideAnchor>
        <GuideAnchor target="ignore_delete_discard" position="bottom" offset={space(3)}>
          <IgnoreActions
            isIgnored={isIgnored}
            onUpdate={this.onUpdate}
            disabled={disabled}
          />
        </GuideAnchor>
        <Tooltip
          disabled={!!group.inbox || disabled}
          title={t('Issue has been reviewed')}
          delay={300}
        >
          <ReviewAction onUpdate={this.onUpdate} disabled={!group.inbox || disabled} />
        </Tooltip>
        <Access organization={organization} access={['event:admin']}>
          {({hasAccess}) => (
            <DeleteAction
              disabled={disabled || !hasAccess}
              organization={organization}
              project={project}
              onDelete={this.onDelete}
              onDiscard={this.onDiscard}
            />
          )}
        </Access>
        {orgFeatures.has('shared-issues') && (
          <ShareIssue
            disabled={disabled}
            loading={this.state.shareBusy}
            isShared={group.isPublic}
            shareUrl={this.getShareUrl(group.shareId)}
            onToggle={this.onToggleShare}
            onReshare={() => this.onShare(true)}
          />
        )}

        <Feature
          hookName="feature-disabled:open-in-discover"
          features={['discover-basic']}
          organization={organization}
        >
          <ActionButton
            disabled={disabled}
            to={disabled ? '' : this.getDiscoverUrl()}
            onClick={() => {
              trackAdvancedAnalyticsEvent('growth.issue_open_in_discover_btn_clicked', {
                organization,
              });
            }}
          >
            <GuideAnchor target="open_in_discover">{t('Open in Discover')}</GuideAnchor>
          </ActionButton>
        </Feature>

        <BookmarkButton
          disabled={disabled}
          isActive={group.isBookmarked}
          title={bookmarkTitle}
          tooltipProps={{delay: 300}}
          aria-label={bookmarkTitle}
          onClick={this.handleClick(disabled, this.onToggleBookmark)}
          icon={<IconStar isSolid size="xs" />}
        />

        <SubscribeAction
          disabled={disabled}
          group={group}
          onClick={this.handleClick(disabled, this.onToggleSubscribe)}
        />

        {displayReprocessEventAction(organization.features, event) && (
          <ReprocessAction
            disabled={disabled}
            icon={<IconRefresh size="xs" />}
            title={t('Reprocess this issue')}
            aria-label={t('Reprocess this issue')}
            onClick={this.handleClick(disabled, this.onReprocessEvent)}
          />
        )}
      </Wrapper>
    );
  }
}

const ReprocessAction = styled(ActionButton)``;

const BookmarkButton = styled(ActionButton)<{isActive: boolean}>`
  ${p =>
    p.isActive &&
    `
   && {
 background: ${p.theme.yellow100};
 color: ${p.theme.yellow300};
 border-color: ${p.theme.yellow300};
 text-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
}
  `}
`;

const Wrapper = styled('div')`
  display: grid;
  justify-content: flex-start;
  align-items: center;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  margin-top: ${space(2)};
  white-space: nowrap;
`;

export {Actions};

export default withApi(withOrganization(Actions));

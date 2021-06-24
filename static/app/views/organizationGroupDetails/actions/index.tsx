import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {bulkDelete, bulkUpdate} from 'app/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {openReprocessEventModal} from 'app/actionCreators/modal';
import GroupActions from 'app/actions/groupActions';
import {Client} from 'app/api';
import ActionButton from 'app/components/actions/button';
import IgnoreActions from 'app/components/actions/ignore';
import ResolveActions from 'app/components/actions/resolve';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Tooltip from 'app/components/tooltip';
import {IconStar} from 'app/icons';
import {IconRefresh} from 'app/icons/iconRefresh';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  Group,
  Organization,
  Project,
  SavedQueryVersions,
  UpdateResolutionStatus,
} from 'app/types';
import {Event} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import {displayReprocessEventAction} from 'app/utils/displayReprocessEventAction';
import {uniqueId} from 'app/utils/guid';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import ReviewAction from 'app/views/issueList/actions/reviewAction';
import ShareIssue from 'app/views/organizationGroupDetails/actions/shareIssue';

import DeleteAction from './deleteAction';
import SubscribeAction from './subscribeAction';

type Props = {
  api: Client;
  group: Group;
  project: Project;
  organization: Organization;
  disabled: boolean;
  event?: Event;
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
  }

  onToggleShare = () => {
    this.onShare(!this.props.group.isPublic);
  };

  onToggleBookmark = () => {
    this.onUpdate({isBookmarked: !this.props.group.isBookmarked});
  };

  onToggleSubscribe = () => {
    this.onUpdate({isSubscribed: !this.props.group.isSubscribed});
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
        >
          <ReviewAction onUpdate={this.onUpdate} disabled={!group.inbox || disabled} />
        </Tooltip>
        <DeleteAction
          disabled={disabled}
          organization={organization}
          project={project}
          onDelete={this.onDelete}
          onDiscard={this.onDiscard}
        />
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

        {orgFeatures.has('discover-basic') && (
          <ActionButton disabled={disabled} to={disabled ? '' : this.getDiscoverUrl()}>
            <GuideAnchor target="open_in_discover">{t('Open in Discover')}</GuideAnchor>
          </ActionButton>
        )}

        <BookmarkButton
          disabled={disabled}
          isActive={group.isBookmarked}
          title={bookmarkTitle}
          label={bookmarkTitle}
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
            label={t('Reprocess this issue')}
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

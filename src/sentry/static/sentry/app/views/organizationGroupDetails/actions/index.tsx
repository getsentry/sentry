import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import GroupActions from 'app/actions/groupActions';
import {Client} from 'app/api';
import IgnoreActions from 'app/components/actions/ignore';
import ResolveActions from 'app/components/actions/resolve';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Link from 'app/components/links/link';
import ShareIssue from 'app/components/shareIssue';
import Tooltip from 'app/components/tooltip';
import {IconRefresh, IconStar} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  Group,
  Organization,
  Project,
  SavedQueryVersions,
  UpdateResolutionStatus,
} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {uniqueId} from 'app/utils/guid';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import ReprocessingDialogForm from 'app/views/organizationGroupDetails/reprocessingDialogForm';

import SubscribeAction from '../subscribeAction';

import DeleteAction from './deleteAction';

type Props = {
  api: Client;
  group: Group;
  project: Project;
  organization: Organization;
  disabled: boolean;
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
      fields: ['title', 'release', 'environment', 'user', 'timestamp'],
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

    api.bulkDelete(
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
    data: {isBookmarked: boolean} | {isSubscribed: boolean} | UpdateResolutionStatus
  ) => {
    const {group, project, organization, api} = this.props;

    addLoadingMessage(t('Saving changes\u2026'));

    api.bulkUpdate(
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

  onReprocess = () => {
    const {group, organization} = this.props;
    openModal(({closeModal, Header, Body}) => (
      <ReprocessingDialogForm
        group={group}
        orgSlug={organization.slug}
        closeModal={closeModal}
        Header={Header}
        Body={Body}
      />
    ));
  };

  onShare(shared: boolean) {
    const {group, project, organization, api} = this.props;
    this.setState({shareBusy: true});

    // not sure why this is a bulkUpdate
    api.bulkUpdate(
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

  handleClick(
    disabled: boolean,
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void
  ) {
    return function (event: React.MouseEvent<HTMLDivElement>) {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onClick(event);
    };
  }

  render() {
    const {group, project, organization, disabled} = this.props;
    const {status, isBookmarked} = group;

    const orgFeatures = new Set(organization.features);
    const projectFeatures = new Set(project.features);

    let buttonClassName = 'btn btn-default btn-sm';
    const bookmarkTitle = isBookmarked ? t('Remove bookmark') : t('Bookmark');
    const hasRelease = !!project.features?.includes('releases');

    const isResolved = status === 'resolved';
    const isIgnored = status === 'ignored';

    if (disabled) {
      buttonClassName = `${buttonClassName} disabled`;
    }

    return (
      <div className="group-actions">
        <GuideAnchor target="resolve" position="bottom" offset={space(3)}>
          <ResolveActions
            disabled={disabled}
            hasRelease={hasRelease}
            latestRelease={project.latestRelease}
            onUpdate={this.onUpdate}
            orgId={organization.slug}
            projectId={project.slug}
            isResolved={isResolved}
            isAutoResolved={isResolved && group.statusDetails.autoResolved}
          />
        </GuideAnchor>
        <GuideAnchor target="ignore_delete_discard" position="bottom" offset={space(3)}>
          <IgnoreActions
            isIgnored={isIgnored}
            onUpdate={this.onUpdate}
            disabled={disabled}
          />
        </GuideAnchor>
        <DeleteAction
          disabled={disabled}
          organization={organization}
          project={project}
          onDelete={this.onDelete}
          onDiscard={this.onDiscard}
        />
        {orgFeatures.has('shared-issues') && (
          <div className="btn-group">
            <ShareIssue
              disabled={disabled}
              loading={this.state.shareBusy}
              isShared={group.isPublic}
              shareUrl={this.getShareUrl(group.shareId)}
              onToggle={this.onToggleShare}
              onReshare={() => this.onShare(true)}
            />
          </div>
        )}
        {orgFeatures.has('discover-basic') && (
          <div className="btn-group">
            <Link
              className={buttonClassName}
              title={t('Open in Discover')}
              to={disabled ? '' : this.getDiscoverUrl()}
            >
              {t('Open in Discover')}
            </Link>
          </div>
        )}
        <div className="btn-group">
          <BookmarkButton
            className={buttonClassName}
            role="button"
            isActive={group.isBookmarked}
            title={bookmarkTitle}
            aria-label={bookmarkTitle}
            onClick={this.handleClick(disabled, this.onToggleBookmark)}
          >
            <IconWrapper>
              <IconStar isSolid size="xs" />
            </IconWrapper>
          </BookmarkButton>
        </div>
        <SubscribeAction
          group={group}
          onClick={this.handleClick(disabled, this.onToggleSubscribe)}
          className={buttonClassName}
        />
        {projectFeatures.has('reprocessing-v2') && (
          <div className="btn-group">
            <Tooltip title={t('Reprocess this issue')}>
              <div
                className={buttonClassName}
                onClick={this.handleClick(disabled, this.onReprocess)}
              >
                <IconWrapper>
                  <IconRefresh size="xs" />
                </IconWrapper>
              </div>
            </Tooltip>
          </div>
        )}
      </div>
    );
  }
}

const IconWrapper = styled('span')`
  position: relative;
  top: 1px;
`;

const BookmarkButton = styled('div')<{isActive: boolean}>`
  ${p =>
    p.isActive &&
    `
    background: ${p.theme.yellow100};
    color: ${p.theme.yellow300};
    border-color: ${p.theme.yellow300};
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
  `}
`;

export {Actions};

export default withApi(withOrganization(Actions));

import {Fragment, MouseEvent, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Query} from 'history';

import {bulkDelete, bulkUpdate} from 'sentry/actionCreators/group';
import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {
  ModalRenderProps,
  openModal,
  openReprocessEventModal,
} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import ArchiveActions, {getArchiveActions} from 'sentry/components/actions/archive';
import ActionButton from 'sentry/components/actions/button';
import IgnoreActions, {getIgnoreActions} from 'sentry/components/actions/ignore';
import ResolveActions from 'sentry/components/actions/resolve';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {
  IconCheckmark,
  IconEllipsis,
  IconMute,
  IconSubscribed,
  IconUnsubscribed,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import IssueListCacheStore from 'sentry/stores/IssueListCacheStore';
import {space} from 'sentry/styles/space';
import {
  Group,
  GroupStatus,
  GroupStatusResolution,
  GroupSubstatus,
  IssueCategory,
  MarkReviewed,
  Organization,
  Project,
  SavedQueryVersions,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {displayReprocessEventAction} from 'sentry/utils/displayReprocessEventAction';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {uniqueId} from 'sentry/utils/guid';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';

import ShareIssueModal from './shareModal';
import SubscribeAction from './subscribeAction';

type UpdateData =
  | {isBookmarked: boolean}
  | {isSubscribed: boolean}
  | MarkReviewed
  | GroupStatusResolution;

const isResolutionStatus = (data: UpdateData): data is GroupStatusResolution => {
  return (data as GroupStatusResolution).status !== undefined;
};

type Props = {
  api: Client;
  disabled: boolean;
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
  query?: Query;
};

export function Actions(props: Props) {
  const {api, group, project, organization, disabled, event, query = {}} = props;
  const {status, isBookmarked} = group;

  const bookmarkKey = isBookmarked ? 'unbookmark' : 'bookmark';
  const bookmarkTitle = isBookmarked ? t('Remove bookmark') : t('Bookmark');
  const hasRelease = !!project.features?.includes('releases');
  const isResolved = status === 'resolved';
  const isAutoResolved =
    group.status === 'resolved' ? group.statusDetails.autoResolved : undefined;
  const isIgnored = status === 'ignored';

  const hasEscalatingIssues = organization.features.includes('escalating-issues');
  const hasDeleteAccess = organization.access.includes('event:admin');

  const config = useMemo(() => getConfigForIssueType(group, project), [group, project]);

  const {
    actions: {
      archiveUntilOccurrence: archiveUntilOccurrenceCap,
      delete: deleteCap,
      deleteAndDiscard: deleteDiscardCap,
      share: shareCap,
      resolveInRelease: resolveInReleaseCap,
    },
    discover: discoverCap,
  } = config;

  const getDiscoverUrl = () => {
    const {title, type, shortId} = group;

    const groupIsOccurrenceBacked =
      group.issueCategory === IssueCategory.PERFORMANCE && !!event?.occurrence;

    const discoverQuery = {
      id: undefined,
      name: title || type,
      fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
      orderby: '-timestamp',
      query: `issue:${shortId}`,
      projects: [Number(project.id)],
      version: 2 as SavedQueryVersions,
      range: '90d',
      dataset:
        config.usesIssuePlatform || groupIsOccurrenceBacked
          ? DiscoverDatasets.ISSUE_PLATFORM
          : undefined,
    };

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(organization.slug);
  };

  const trackIssueAction = (
    action:
      | 'shared'
      | 'deleted'
      | 'bookmarked'
      | 'subscribed'
      | 'mark_reviewed'
      | 'discarded'
      | 'open_in_discover'
      | GroupStatus,
    substatus?: GroupSubstatus | null,
    statusDetailsKey?: string
  ) => {
    const {alert_date, alert_rule_id, alert_type} = query;
    trackAnalytics('issue_details.action_clicked', {
      organization,
      action_type: action,
      action_substatus: substatus ?? undefined,
      action_status_details: statusDetailsKey,
      // Alert properties track if the user came from email/slack alerts
      alert_date:
        typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined,
      ...getAnalyticsDataForGroup(group),
      ...getAnalyicsDataForProject(project),
    });
  };

  const onDelete = () => {
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

          browserHistory.push(
            normalizeUrl({
              pathname: `/organizations/${organization.slug}/issues/`,
              query: {project: project.id},
            })
          );
        },
      }
    );

    trackIssueAction('deleted');
    IssueListCacheStore.reset();
  };

  const onUpdate = (data: UpdateData) => {
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

    if (isResolutionStatus(data)) {
      trackIssueAction(
        data.status,
        data.substatus,
        Object.keys(data.statusDetails || {})[0]
      );
    }
    if ((data as {inbox: boolean}).inbox !== undefined) {
      trackIssueAction('mark_reviewed');
    }
    IssueListCacheStore.reset();
  };

  const onReprocessEvent = () => {
    openReprocessEventModal({organization, groupId: group.id});
  };

  const onToggleShare = () => {
    const newIsPublic = !group.isPublic;
    if (newIsPublic) {
      trackAnalytics('issue.shared_publicly', {
        organization,
      });
    }
    trackIssueAction('shared');
  };

  const onToggleBookmark = () => {
    onUpdate({isBookmarked: !group.isBookmarked});
    trackIssueAction('bookmarked');
  };

  const onToggleSubscribe = () => {
    onUpdate({isSubscribed: !group.isSubscribed});
    trackIssueAction('subscribed');
  };

  const onDiscard = () => {
    const id = uniqueId();
    addLoadingMessage(t('Discarding event\u2026'));

    GroupStore.onDiscard(id, group.id);

    api.request(`/issues/${group.id}/`, {
      method: 'PUT',
      data: {discard: true},
      success: response => {
        GroupStore.onDiscardSuccess(id, group.id, response);
        browserHistory.push(
          normalizeUrl({
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {project: project.id},
          })
        );
      },
      error: error => {
        GroupStore.onDiscardError(id, group.id, error);
      },
      complete: clearIndicators,
    });
    trackIssueAction('discarded');
    IssueListCacheStore.reset();
  };

  const renderDiscardModal = ({Body, Footer, closeModal}: ModalRenderProps) => {
    function renderDiscardDisabled({children, ...innerProps}) {
      return children({
        ...innerProps,
        renderDisabled: ({features}: {features: string[]}) => (
          <FeatureDisabled
            alert
            featureName={t('Discard and Delete')}
            features={features}
          />
        ),
      });
    }

    return (
      <Feature
        features="projects:discard-groups"
        hookName="feature-disabled:discard-groups"
        organization={organization}
        project={project}
        renderDisabled={renderDiscardDisabled}
      >
        {({hasFeature, renderDisabled, ...innerProps}) => (
          <Fragment>
            <Body>
              {!hasFeature &&
                typeof renderDisabled === 'function' &&
                renderDisabled({...innerProps, hasFeature, children: null})}
              {t(
                `Discarding this event will result in the deletion of most data associated with this issue and future events being discarded before reaching your stream. Are you sure you wish to continue?`
              )}
            </Body>
            <Footer>
              <Button onClick={closeModal}>{t('Cancel')}</Button>
              <Button
                style={{marginLeft: space(1)}}
                priority="primary"
                onClick={onDiscard}
                disabled={!hasFeature}
              >
                {t('Discard Future Events')}
              </Button>
            </Footer>
          </Fragment>
        )}
      </Feature>
    );
  };

  const openDeleteModal = () =>
    openModal(({Body, Footer, closeModal}: ModalRenderProps) => (
      <Fragment>
        <Body>
          {t('Deleting this issue is permanent. Are you sure you wish to continue?')}
        </Body>
        <Footer>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button style={{marginLeft: space(1)}} priority="primary" onClick={onDelete}>
            {t('Delete')}
          </Button>
        </Footer>
      </Fragment>
    ));

  const openDiscardModal = () => {
    openModal(renderDiscardModal);
  };

  const openShareModal = () => {
    openModal(modalProps => (
      <ShareIssueModal
        {...modalProps}
        organization={organization}
        projectSlug={group.project.slug}
        groupId={group.id}
        onToggle={onToggleShare}
      />
    ));
  };

  const handleClick = (onClick: (event?: MouseEvent) => void) => {
    return function (innerEvent: MouseEvent) {
      if (disabled) {
        innerEvent.preventDefault();
        innerEvent.stopPropagation();
        return;
      }

      onClick(innerEvent);
    };
  };

  const {dropdownItems, onIgnore} = getIgnoreActions({onUpdate});
  const {dropdownItems: archiveDropdownItems} = getArchiveActions({
    onUpdate,
  });
  return (
    <ActionWrapper>
      <DropdownMenu
        triggerProps={{
          'aria-label': t('More Actions'),
          icon: <IconEllipsis />,
          showChevron: false,
          size: 'sm',
        }}
        items={[
          ...(isIgnored || hasEscalatingIssues
            ? []
            : [
                {
                  key: 'ignore',
                  className: 'hidden-sm hidden-md hidden-lg',
                  label: t('Ignore'),
                  isSubmenu: true,
                  disabled,
                  children: [
                    {
                      key: 'ignore-now',
                      label: t('Ignore Issue'),
                      onAction: () => onIgnore(),
                    },
                    ...dropdownItems,
                  ],
                },
              ]),
          ...(hasEscalatingIssues
            ? isIgnored
              ? []
              : [
                  {
                    key: 'Archive',
                    className: 'hidden-sm hidden-md hidden-lg',
                    label: t('Archive'),
                    isSubmenu: true,
                    disabled,
                    children: archiveDropdownItems,
                  },
                ]
            : []),
          {
            key: 'open-in-discover',
            className: 'hidden-sm hidden-md hidden-lg',
            label: t('Open in Discover'),
            to: disabled ? '' : getDiscoverUrl(),
            onAction: () => trackIssueAction('open_in_discover'),
          },
          {
            key: group.isSubscribed ? 'unsubscribe' : 'subscribe',
            className: 'hidden-sm hidden-md hidden-lg',
            label: group.isSubscribed ? t('Unsubscribe') : t('Subscribe'),
            disabled: disabled || group.subscriptionDetails?.disabled,
            onAction: onToggleSubscribe,
          },
          {
            key: 'mark-review',
            label: t('Mark reviewed'),
            disabled: !group.inbox || disabled,
            details: !group.inbox || disabled ? t('Issue has been reviewed') : undefined,
            onAction: () => onUpdate({inbox: false}),
          },
          {
            key: 'share',
            label: t('Share'),
            disabled: disabled || !shareCap.enabled,
            hidden: !organization.features.includes('shared-issues'),
            onAction: openShareModal,
          },
          {
            key: bookmarkKey,
            label: bookmarkTitle,
            onAction: onToggleBookmark,
          },
          {
            key: 'reprocess',
            label: t('Reprocess events'),
            hidden: !displayReprocessEventAction(organization.features, event),
            onAction: onReprocessEvent,
          },
          {
            key: 'delete-issue',
            priority: 'danger',
            label: t('Delete'),
            hidden: !hasDeleteAccess,
            disabled: !deleteCap.enabled,
            details: deleteCap.disabledReason,
            onAction: openDeleteModal,
          },
          {
            key: 'delete-and-discard',
            priority: 'danger',
            label: t('Delete and discard future events'),
            hidden: !hasDeleteAccess,
            disabled: !deleteDiscardCap.enabled,
            details: deleteDiscardCap.disabledReason,
            onAction: openDiscardModal,
          },
        ]}
      />
      <SubscribeAction
        className="hidden-xs"
        disabled={disabled}
        disablePriority
        group={group}
        onClick={handleClick(onToggleSubscribe)}
        icon={group.isSubscribed ? <IconSubscribed /> : <IconUnsubscribed />}
        size="sm"
      />
      <div className="hidden-xs">
        <EnvironmentPageFilter position="bottom-end" size="sm" />
      </div>
      {discoverCap.enabled && (
        <Feature
          hookName="feature-disabled:open-in-discover"
          features="discover-basic"
          organization={organization}
        >
          <ActionButton
            className="hidden-xs"
            disabled={disabled}
            to={disabled ? '' : getDiscoverUrl()}
            onClick={() => trackIssueAction('open_in_discover')}
            size="sm"
          >
            <GuideAnchor target="open_in_discover">{t('Open in Discover')}</GuideAnchor>
          </ActionButton>
        </Feature>
      )}
      {isResolved || isIgnored ? (
        <ActionButton
          priority="primary"
          title={
            isAutoResolved
              ? t(
                  'This event is resolved due to the Auto Resolve configuration for this project'
                )
              : t('Change status to unresolved')
          }
          size="sm"
          icon={
            hasEscalatingIssues ? null : isResolved ? <IconCheckmark /> : <IconMute />
          }
          disabled={disabled || isAutoResolved}
          onClick={() =>
            onUpdate({
              status: GroupStatus.UNRESOLVED,
              statusDetails: {},
              substatus: GroupSubstatus.ONGOING,
            })
          }
        >
          {isIgnored
            ? hasEscalatingIssues
              ? t('Archived')
              : t('Ignored')
            : t('Resolved')}
        </ActionButton>
      ) : (
        <Fragment>
          {hasEscalatingIssues ? (
            <GuideAnchor target="issue_details_archive_button" position="bottom">
              <ArchiveActions
                className="hidden-xs"
                size="sm"
                isArchived={isIgnored}
                onUpdate={onUpdate}
                disabled={disabled}
                disableArchiveUntilOccurrence={!archiveUntilOccurrenceCap.enabled}
              />
            </GuideAnchor>
          ) : (
            <IgnoreActions
              className="hidden-xs"
              isIgnored={isIgnored}
              onUpdate={onUpdate}
              disabled={disabled}
              size="sm"
            />
          )}
          <GuideAnchor target="resolve" position="bottom" offset={20}>
            <ResolveActions
              disableResolveInRelease={!resolveInReleaseCap.enabled}
              disabled={disabled}
              disableDropdown={disabled}
              hasRelease={hasRelease}
              latestRelease={project.latestRelease}
              onUpdate={onUpdate}
              projectSlug={project.slug}
              isResolved={isResolved}
              isAutoResolved={isAutoResolved}
              size="sm"
              priority="primary"
            />
          </GuideAnchor>
        </Fragment>
      )}
    </ActionWrapper>
  );
}

const ActionWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

export default withApi(withOrganization(Actions));

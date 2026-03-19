import type {MouseEvent} from 'react';
import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {bulkDelete, bulkUpdate} from 'sentry/actionCreators/group';
import {
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal, openReprocessEventModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {ArchiveActions} from 'sentry/components/actions/archive';
import {ResolveActions} from 'sentry/components/actions/resolve';
import {renderArchiveReason} from 'sentry/components/archivedBox';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {renderResolutionReason} from 'sentry/components/resolutionBox';
import {
  IconCheckmark,
  IconEllipsis,
  IconSubscribed,
  IconUnsubscribed,
  IconUpload,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import type {Event} from 'sentry/types/event';
import type {Group, GroupStatusResolution, MarkReviewed} from 'sentry/types/group';
import {GroupStatus, GroupSubstatus} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {displayReprocessEventAction} from 'sentry/utils/displayReprocessEventAction';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {uniqueId} from 'sentry/utils/guid';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import {useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ShareIssueModal} from 'sentry/views/issueDetails/actions/shareModal';
import {SubscribeAction} from 'sentry/views/issueDetails/actions/subscribeAction';
import {Divider} from 'sentry/views/issueDetails/divider';
import {makeFetchGroupQueryKey} from 'sentry/views/issueDetails/useGroup';
import {useProjectReleaseVersionIsSemver} from 'sentry/views/issueDetails/useProjectReleaseVersionIsSemver';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';
import {isVersionInfoSemver} from 'sentry/views/releases/utils';

type UpdateData =
  | {isBookmarked: boolean}
  | {isSubscribed: boolean}
  | MarkReviewed
  | GroupStatusResolution;

const isResolutionStatus = (data: UpdateData): data is GroupStatusResolution => {
  return (data as GroupStatusResolution).status !== undefined;
};

interface GroupActionsProps {
  disabled: boolean;
  event: Event | null;
  group: Group;
  project: Project;
}

export function GroupActions({group, project, disabled, event}: GroupActionsProps) {
  const theme = useTheme();
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const environments = useEnvironmentsFromUrl();

  const bookmarkKey = group.isBookmarked ? 'unbookmark' : 'bookmark';
  const bookmarkTitle = group.isBookmarked ? t('Remove bookmark') : t('Bookmark');
  const hasRelease = !!project.features?.includes('releases');

  const eventReleaseVersion = event?.release?.versionInfo?.version;

  const projHasSemverRelease = useProjectReleaseVersionIsSemver({
    version: project.latestRelease?.version,
    enabled: !eventReleaseVersion,
  });

  const hasSemverRelease = eventReleaseVersion
    ? isVersionInfoSemver(eventReleaseVersion)
    : projHasSemverRelease;

  const hasSemverReleaseFeature = hasSemverRelease;

  const isResolved = group.status === 'resolved';
  const isAutoResolved =
    group.status === 'resolved' ? group.statusDetails.autoResolved : undefined;
  const isIgnored = group.status === 'ignored';

  const hasDeleteAccess = organization.access.includes('event:admin');

  const config = useMemo(() => getConfigForIssueType(group, project), [group, project]);

  const {
    actions: {
      archiveUntilOccurrence: archiveUntilOccurrenceCap,
      delete: deleteCap,
      deleteAndDiscard: deleteDiscardCap,
      resolve: resolveCap,
      resolveInRelease: resolveInReleaseCap,
      share: shareCap,
    },
    customCopy: {resolution: resolvedCopyCap},
  } = config;

  const trackIssueAction = (
    action:
      | 'shared'
      | 'deleted'
      | 'bookmarked'
      | 'subscribed'
      | 'mark_reviewed'
      | 'discarded'
      | GroupStatus,
    substatus?: GroupSubstatus | null,
    statusDetailsKey?: string
  ) => {
    const {alert_date, alert_rule_id, alert_type} = location.query;
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
      org_streamline_only: organization.streamlineOnly ?? undefined,
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

          addSuccessMessage(t('Issue deleted'));
          navigate({
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {project: project.id},
          });
        },
      }
    );

    trackIssueAction('deleted');
    IssueListCacheStore.reset();
  };

  const onUpdate = (data: UpdateData, onComplete?: () => void) => {
    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data,
      },
      {
        complete: () => {
          clearIndicators();
          onComplete?.();
          queryClient.invalidateQueries({
            queryKey: makeFetchGroupQueryKey({
              organizationSlug: organization.slug,
              groupId: group.id,
              environments,
            }),
          });
        },
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

  const onTogglePublicShare = () => {
    const newIsPublic = !group.isPublic;
    if (newIsPublic) {
      trackAnalytics('issue.shared_publicly', {
        organization,
      });
    }
    trackIssueAction('shared');
  };

  const onToggleBookmark = () => {
    onUpdate({isBookmarked: !group.isBookmarked}, () => {
      trackIssueAction('bookmarked');
      addSuccessMessage(
        group.isBookmarked ? t('Issue bookmark removed') : t('Issue bookmarked')
      );
    });
  };

  const onToggleSubscribe = () => {
    onUpdate({isSubscribed: !group.isSubscribed}, () => {
      trackIssueAction('subscribed');
      addSuccessMessage(
        group.isSubscribed ? t('Unsubscribed from issue') : t('Subscribed to issue')
      );
    });
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
        navigate({
          pathname: `/organizations/${organization.slug}/issues/`,
          query: {project: project.id},
        });
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
    function renderDiscardDisabled({children, ...innerProps}: any) {
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
                style={{marginLeft: theme.space.md}}
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
    openConfirmModal({
      message: t('Deleting this issue is permanent. Are you sure you wish to continue?'),
      priority: 'danger',
      confirmText: t('Delete'),
      onConfirm: onDelete,
    });

  const openDiscardModal = () => {
    openModal(renderDiscardModal);
  };

  const openShareModal = () => {
    openModal(modalProps => (
      <ShareIssueModal
        {...modalProps}
        organization={organization}
        groupId={group.id}
        event={event}
        onToggle={onTogglePublicShare}
        projectSlug={project.slug}
        hasIssueShare={shareCap.enabled}
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

  return (
    <Flex align="center" gap="xs">
      {isResolved || isIgnored ? (
        <Flex align="center" gap="md">
          <ResolvedWrapper>
            <IconCheckmark size="md" />
            <Flex direction="column">
              {isResolved ? resolvedCopyCap || t('Resolved') : t('Archived')}
              <ReasonBanner>
                {group.status === 'resolved'
                  ? renderResolutionReason({
                      statusDetails: group.statusDetails,
                      activities: group.activity,
                      hasStreamlinedUI: true,
                      project,
                      organization,
                    })
                  : null}
                {group.status === 'ignored'
                  ? renderArchiveReason({
                      substatus: group.substatus,
                      statusDetails: group.statusDetails,
                      organization,
                      hasStreamlinedUI: true,
                    })
                  : null}
              </ReasonBanner>
            </Flex>
          </ResolvedWrapper>

          <Divider />
          {resolveCap.enabled && isResolved && (
            <Button
              size="sm"
              disabled={disabled || isAutoResolved}
              onClick={() =>
                onUpdate({
                  status: GroupStatus.UNRESOLVED,
                  statusDetails: {},
                  substatus: GroupSubstatus.ONGOING,
                })
              }
            >
              {t('Unresolve')}
            </Button>
          )}
          {isIgnored && (
            <Button
              size="sm"
              disabled={disabled || isAutoResolved}
              onClick={() =>
                onUpdate({
                  status: GroupStatus.UNRESOLVED,
                  statusDetails: {},
                  substatus: GroupSubstatus.ONGOING,
                })
              }
            >
              {t('Unarchive')}
            </Button>
          )}
        </Flex>
      ) : (
        <Fragment>
          {resolveCap.enabled && (
            <ResolveActions
              disableResolveInRelease={!resolveInReleaseCap.enabled}
              disabled={disabled}
              disableDropdown={disabled}
              hasRelease={hasRelease}
              latestRelease={project.latestRelease}
              hasSemverReleaseFeature={hasSemverReleaseFeature}
              onUpdate={onUpdate}
              projectSlug={project.slug}
              isResolved={isResolved}
              isAutoResolved={isAutoResolved}
              size="sm"
              priority="primary"
            />
          )}
          <ArchiveActions
            size="sm"
            isArchived={isIgnored}
            onUpdate={onUpdate}
            disabled={disabled}
            disableArchiveUntilOccurrence={!archiveUntilOccurrenceCap.enabled}
          />
        </Fragment>
      )}
      <SubscribeAction
        disabled={disabled}
        disablePriority
        group={group}
        onClick={handleClick(onToggleSubscribe)}
        icon={group.isSubscribed ? <IconSubscribed /> : <IconUnsubscribed />}
        size="sm"
      />
      <Button
        size="sm"
        onClick={openShareModal}
        icon={<IconUpload />}
        aria-label={t('Share')}
        tooltipProps={{title: t('Share Issue')}}
        disabled={disabled}
        analyticsEventKey="issue_details.share_action_clicked"
        analyticsEventName="Issue Details: Share Action Clicked"
      />
      <DropdownMenu
        triggerProps={{
          'aria-label': t('More Actions'),
          icon: <IconEllipsis />,
          showChevron: false,
          size: 'sm',
        }}
        items={[
          {
            key: 'mark-review',
            label: t('Mark reviewed'),
            disabled: !group.inbox || disabled,
            details: !group.inbox || disabled ? t('Issue has been reviewed') : undefined,
            onAction: () => onUpdate({inbox: false}),
          },
          {
            key: bookmarkKey,
            label: bookmarkTitle,
            onAction: onToggleBookmark,
          },
          {
            key: 'reprocess',
            label: t('Reprocess events'),
            hidden: !displayReprocessEventAction(event),
            onAction: onReprocessEvent,
          },
          {
            key: 'delete-issue',
            priority: 'danger',
            label: t('Delete'),
            disabled: !hasDeleteAccess || !deleteCap.enabled,
            details: hasDeleteAccess
              ? deleteCap.disabledReason
              : t('Only admins can delete issues'),
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
    </Flex>
  );
}

const ResolvedWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.lg};
  align-items: center;
  color: ${p => p.theme.colors.green500};
  font-weight: bold;
  font-size: ${p => p.theme.font.size.lg};
`;

const ReasonBanner = styled('div')`
  font-weight: normal;
  color: ${p => p.theme.colors.green500};
  font-size: ${p => p.theme.font.size.sm};
`;

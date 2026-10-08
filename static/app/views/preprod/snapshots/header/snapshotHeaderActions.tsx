import {IconCheckmark} from '@sentry/icons/iconCheckmark';
import {IconDelete} from '@sentry/icons/iconDelete';
import {IconDownload} from '@sentry/icons/iconDownload';
import {IconEllipsis} from '@sentry/icons/iconEllipsis';
import {IconInfo} from '@sentry/icons/iconInfo';
import {IconOpen} from '@sentry/icons/iconOpen';
import {IconReceipt} from '@sentry/icons/iconReceipt';
import {IconRefresh} from '@sentry/icons/iconRefresh';
import {IconSettings} from '@sentry/icons/iconSettings';
import {IconThumb} from '@sentry/icons/iconThumb';
import {IconTimer} from '@sentry/icons/iconTimer';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {AvatarList} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, useResponsivePropValue} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {SnapshotStatusBadge} from 'sentry/components/preprod/snapshotStatusBadge';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {AvatarUser} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {openBuildDebugInfoModal} from 'sentry/views/preprod/snapshots/header/buildDebugInfoModal';
import {
  isForceApprovableSnapshotState,
  isSnapshotApproved,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';
import {getSnapshotPath} from 'sentry/views/preprod/utils/buildLinkUtils';
import {handleStaffPermissionError} from 'sentry/views/preprod/utils/staffPermissionError';

interface SnapshotHeaderActionsProps {
  apiUrl: ReturnType<typeof getApiUrl>;
  data: SnapshotDetailsApiResponse;
  organizationSlug: string;
}

function handleRequestError(error: RequestError, message: string) {
  if (error.status === 403) {
    handleStaffPermissionError(error.responseJSON?.detail);
  } else {
    addErrorMessage(message);
  }
}

export function SnapshotHeaderActions({
  data,
  organizationSlug,
  apiUrl,
}: SnapshotHeaderActionsProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const organization = useOrganization();
  const approveButtonSize = useResponsivePropValue<'xs' | 'sm'>({
    zero: 'xs',
    sm: 'sm',
  });
  const isSentryEmployee = useIsSentryEmployee();
  const project = ProjectsStore.getById(data.project_id);

  const comparisonState = data.comparison_state;
  const approvalStatus = data.approval_status;
  const isApproved = isSnapshotApproved(approvalStatus);
  const isAutoApproved = approvalStatus === 'auto_approved';
  const canForceApprove = isForceApprovableSnapshotState(comparisonState) && !isApproved;
  const approvers: AvatarUser[] = (data.approvers ?? []).map((a, i) => ({
    id: a.id ?? `approver-${i}`,
    name: a.name ?? '',
    email: a.email ?? '',
    username: a.username ?? '',
    ip_address: '',
    avatar: a.avatar_url
      ? {
          avatarType: 'upload' as const,
          avatarUuid: '',
          avatarUrl: a.avatar_url,
        }
      : undefined,
  }));

  const {mutate: submitApproval, isPending: isApproving} = useMutation<
    unknown,
    RequestError,
    {forced: boolean; successMessage: string}
  >({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/preprodartifacts/$artifactId/approve/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              artifactId: data.head_artifact_id,
            },
          }
        ),
        method: 'POST',
        data: {feature_type: 'snapshots'},
      }),
    onMutate: ({forced}) => {
      trackAnalytics('preprod.snapshots.details.approve_clicked', {
        organization,
        build_id: data.head_artifact_id,
        forced,
      });
    },
    onSuccess: (_resp, {successMessage}) => {
      addSuccessMessage(successMessage);
      queryClient.invalidateQueries({queryKey: [apiUrl]});
    },
    onError: error => handleRequestError(error, t('Failed to approve snapshot')),
  });

  const handleApprove = () =>
    submitApproval({forced: false, successMessage: t('Snapshot approved')});
  const handleReapprove = () =>
    submitApproval({
      forced: isForceApprovableSnapshotState(comparisonState),
      successMessage: t('Approval re-sent to GitHub'),
    });

  const handleForceApprove = () => {
    openConfirmModal({
      header: t('Force approve snapshots'),
      message: t(
        'This build has no successful comparison. Approving marks the snapshot status check as passing without reviewing any changes.'
      ),
      confirmText: t('Force approve'),
      priority: 'danger',
      onConfirm: () =>
        submitApproval({forced: true, successMessage: t('Snapshot approved')}),
    });
  };

  const {mutate: rerunStatusChecks} = useMutation<unknown, RequestError>({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/preprod-artifact/rerun-status-checks/$headArtifactId/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              headArtifactId: data.head_artifact_id,
            },
          }
        ),
        method: 'POST',
        data: {check_types: ['snapshots']},
      }),
    onSuccess: () => {
      addSuccessMessage(t('Status checks rerun initiated'));
      queryClient.invalidateQueries({queryKey: [apiUrl]});
    },
    onError: () => {
      addErrorMessage(t('Failed to rerun status checks'));
    },
  });

  const {mutate: rerunComparison} = useMutation<unknown, RequestError>({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/recompare/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              snapshotId: data.head_artifact_id,
            },
          }
        ),
        method: 'POST',
      }),
    onSuccess: () => {
      addSuccessMessage(t('Re-run comparison initiated'));
      queryClient.invalidateQueries({queryKey: [apiUrl]});
    },
    onError: error => handleRequestError(error, t('Failed to re-run comparison')),
  });

  const {mutate: deleteSnapshot, isPending: isDeleting} = useMutation<
    unknown,
    RequestError
  >({
    mutationFn: () => fetchMutation({url: apiUrl, method: 'DELETE'}),
    onSuccess: () => {
      addSuccessMessage(t('Snapshot deleted'));
      // TODO(preprod): Redirect to snapshot builds list once that UI is added
      navigate('/');
    },
    onError: error => handleRequestError(error, t('Failed to delete snapshot')),
  });

  const archivePathParams = {
    organizationIdOrSlug: organizationSlug,
    snapshotId: data.head_artifact_id,
  };
  const archiveUrl = getApiUrl(
    '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/archive/',
    {path: archivePathParams}
  );

  const {mutate: buildArchive, isPending: isBuildingArchive} = useMutation<
    unknown,
    RequestError
  >({
    mutationFn: () => fetchMutation({url: archiveUrl, method: 'POST'}),
    onSuccess: () => {
      addSuccessMessage(
        t(
          "We're building your snapshot images — we'll email you a download link when it's ready."
        )
      );
    },
    onError: error =>
      handleRequestError(error, t('Failed to start snapshot image export.')),
  });

  // Probe readiness first: a built archive downloads immediately, otherwise we
  // confirm and kick off an async build that emails a link when it's ready.
  const {mutate: downloadImages, isPending: isCheckingArchive} = useMutation<
    ApiResponse<{ready?: boolean}>,
    RequestError
  >({
    mutationFn: () =>
      queryClient.fetchQuery({
        ...apiOptions.as<{ready?: boolean}>()(
          '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/archive/',
          {path: archivePathParams, staleTime: 0}
        ),
        retry: false,
      }),
    onSuccess: ({json}) => {
      if (json.ready) {
        downloadFromHref(
          `snapshot_images_${data.head_artifact_id}.zip`,
          `/api/0${archiveUrl}?download=true`
        );
        return;
      }
      openConfirmModal({
        header: t('Export all snapshots to a zip file'),
        message: t(
          "Exporting can take a bit, so we'll email you when the .zip is ready and available for download here."
        ),
        onConfirm: () => buildArchive(),
      });
    },
    onError: error =>
      handleRequestError(error, t('Failed to check snapshot image download.')),
  });
  const isExporting = isCheckingArchive || isBuildingArchive;

  const approverAvatars =
    approvers.length > 0 ? (
      <Container display={{zero: 'none', '3xl': 'flex'}}>
        <AvatarList users={approvers} avatarSize={24} maxVisibleAvatars={2} />
      </Container>
    ) : null;

  return (
    <Flex align="center" gap="md">
      {comparisonState === 'success' ? (
        isApproved ? (
          <Flex align="center" gap="xl">
            <Flex align="center" gap="xs">
              <Tag variant="success" icon={<IconCheckmark />}>
                {isAutoApproved ? t('Auto-approved') : t('Approved')}
              </Tag>
              {isAutoApproved && (
                <Tooltip
                  title={t(
                    'Automatically approved because the changes match a previously approved build on this PR.'
                  )}
                >
                  <Flex align="center">
                    <IconInfo size="sm" />
                  </Flex>
                </Tooltip>
              )}
            </Flex>
            {approverAvatars}
          </Flex>
        ) : approvalStatus === 'requires_approval' ? (
          <Flex align="center" gap="sm">
            <Container display={{zero: 'none', '4xl': 'block'}}>
              <Tag variant="warning" icon={<IconTimer />}>
                {t('Needs approval')}
              </Tag>
            </Container>
            <Button
              size={approveButtonSize}
              variant="primary"
              icon={<IconThumb />}
              onClick={handleApprove}
              disabled={isApproving}
            >
              {t('Approve')}
            </Button>
          </Flex>
        ) : null
      ) : (
        <Flex align="center" gap="xl">
          <SnapshotStatusBadge
            comparisonState={comparisonState}
            approvalStatus={approvalStatus}
            errorMessage={data.comparison_error_message}
          />
          {isApproved && approverAvatars}
        </Flex>
      )}

      <ConfirmDelete
        message={t(
          'Are you sure you want to delete this snapshot? This action cannot be undone and will permanently remove all associated files and data.'
        )}
        confirmInput="delete"
        onConfirm={() => deleteSnapshot()}
      >
        {({open: openDeleteModal}) => {
          const menuItems: MenuItemProps[] = [];

          menuItems.push({
            key: 'build-debug-info',
            label: (
              <Flex align="center" gap="sm">
                <IconReceipt size="sm" />
                {t('Build Metadata')}
              </Flex>
            ),
            onAction: () => openBuildDebugInfoModal(data),
            textValue: t('Build Metadata'),
          });

          if (data.base_artifact_id) {
            const baseBuildPath = getSnapshotPath({
              organizationSlug,
              snapshotId: data.base_artifact_id,
            });
            menuItems.push({
              key: 'go-to-base-build',
              label: (
                <Flex align="center" gap="sm">
                  <IconOpen size="sm" />
                  {t('Go to Base Build')}
                </Flex>
              ),
              onAction: () => navigate(baseBuildPath),
              textValue: t('Go to Base Build'),
            });
          }

          menuItems.push(
            {
              key: 'download-images',
              label: (
                <Flex align="center" gap="sm">
                  <IconDownload size="sm" />
                  {t('Download Images')}
                </Flex>
              ),
              onAction: () => downloadImages(),
              textValue: t('Download Images'),
              disabled: isExporting,
            },
            {
              key: 'rerun-status-checks',
              label: (
                <Flex align="center" gap="sm">
                  <IconRefresh size="sm" />
                  {t('Rerun Status Checks')}
                </Flex>
              ),
              onAction: () => rerunStatusChecks(),
              textValue: t('Rerun Status Checks'),
            },
            ...(approvalStatus === 'approved'
              ? [
                  {
                    key: 'reapprove',
                    label: (
                      <Flex align="center" gap="sm">
                        <IconThumb size="sm" />
                        {t('Re-approve')}
                      </Flex>
                    ),
                    onAction: handleReapprove,
                    textValue: t('Re-approve'),
                    disabled: isApproving,
                  },
                ]
              : []),
            ...(canForceApprove
              ? [
                  {
                    key: 'force-approve',
                    label: (
                      <Flex align="center" gap="sm">
                        <IconThumb size="sm" />
                        {t('Force Approve')}
                      </Flex>
                    ),
                    onAction: handleForceApprove,
                    textValue: t('Force Approve'),
                    disabled: isApproving,
                  },
                ]
              : []),
            ...(project
              ? [
                  {
                    key: 'snapshot-settings',
                    label: (
                      <Flex align="center" gap="sm">
                        <IconSettings size="sm" />
                        {t('Snapshot Settings')}
                      </Flex>
                    ),
                    onAction: () =>
                      navigate(
                        `/settings/${organizationSlug}/projects/${project.slug}/snapshots/`
                      ),
                    textValue: t('Snapshot Settings'),
                  },
                ]
              : []),
            {
              key: 'delete',
              label: (
                <Flex align="center" gap="sm">
                  <IconDelete size="sm" variant="danger" />
                  <Text variant="danger">{t('Delete Snapshots')}</Text>
                </Flex>
              ),
              onAction: openDeleteModal,
              textValue: t('Delete Snapshots'),
            }
          );

          if (isSentryEmployee) {
            menuItems.push({
              key: 'admin-section',
              label: t('Admin (Sentry Employees only)'),
              children: [
                {
                  key: 'rerun-comparison',
                  label: (
                    <Flex align="center" gap="sm">
                      <IconRefresh size="sm" />
                      {t('Re-run comparison')}
                    </Flex>
                  ),
                  onAction: () => rerunComparison(),
                  textValue: t('Re-run comparison'),
                },
              ],
            });
          }

          return (
            <DropdownMenu
              items={menuItems}
              trigger={triggerProps => (
                <OverlayTrigger.IconButton
                  {...triggerProps}
                  size="sm"
                  icon={<IconEllipsis />}
                  aria-label={t('More actions')}
                  disabled={isDeleting}
                />
              )}
            />
          );
        }}
      </ConfirmDelete>
    </Flex>
  );
}

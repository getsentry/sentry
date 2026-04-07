import {useCallback, useEffect, useRef, useState} from 'react';

import {AvatarList} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {
  IconCheckmark,
  IconDelete,
  IconEllipsis,
  IconRefresh,
  IconThumb,
  IconTimer,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';
import {useQueryClient} from 'sentry/utils/queryClient';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';
import {handleStaffPermissionError} from 'sentry/views/preprod/utils/staffPermissionError';

interface SnapshotHeaderActionsProps {
  apiUrl: string;
  data: SnapshotDetailsApiResponse;
  organizationSlug: string;
}

export function SnapshotHeaderActions({
  data,
  organizationSlug,
  apiUrl,
}: SnapshotHeaderActionsProps) {
  const queryClient = useQueryClient();
  const clientRef = useRef(new Client());
  useEffect(() => () => clientRef.current.clear(), []);
  const navigate = useNavigate();
  const isSentryEmployee = useIsSentryEmployee();
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isApproved = data.approval_info?.status === 'approved';
  const approvers: AvatarUser[] = (data.approval_info?.approvers ?? []).map((a, i) => ({
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

  const handleApprove = useCallback(() => {
    setIsApproving(true);
    clientRef.current.request(
      `/organizations/${organizationSlug}/preprodartifacts/${data.head_artifact_id}/approve/`,
      {
        method: 'POST',
        data: {feature_type: 'snapshots'},
        success: () => {
          addSuccessMessage(t('Snapshot approved'));
          queryClient.invalidateQueries({queryKey: [apiUrl]});
          setIsApproving(false);
        },
        error: (resp: any) => {
          setIsApproving(false);
          if (resp?.status === 403) {
            handleStaffPermissionError(resp?.responseJSON?.detail);
          } else {
            addErrorMessage(t('Failed to approve snapshot'));
          }
        },
      }
    );
  }, [organizationSlug, data.head_artifact_id, queryClient, apiUrl]);

  const handleRerunStatusChecks = useCallback(() => {
    clientRef.current.request(
      `/organizations/${organizationSlug}/preprod-artifact/rerun-status-checks/${data.head_artifact_id}/`,
      {
        method: 'POST',
        data: {check_types: ['snapshots']},
        success: () => {
          addSuccessMessage(t('Status checks rerun initiated'));
          queryClient.invalidateQueries({queryKey: [apiUrl]});
        },
        error: (_resp: any) => {
          addErrorMessage(t('Failed to rerun status checks'));
        },
      }
    );
  }, [organizationSlug, data.head_artifact_id, queryClient, apiUrl]);

  const handleRerunComparison = useCallback(() => {
    clientRef.current.request(
      `/organizations/${organizationSlug}/preprodartifacts/snapshots/${data.head_artifact_id}/recompare/`,
      {
        method: 'POST',
        success: () => {
          addSuccessMessage(t('Re-run comparison initiated'));
          queryClient.invalidateQueries({queryKey: [apiUrl]});
        },
        error: (resp: any) => {
          if (resp?.status === 403) {
            handleStaffPermissionError(resp?.responseJSON?.detail);
          } else {
            addErrorMessage(t('Failed to re-run comparison'));
          }
        },
      }
    );
  }, [organizationSlug, data.head_artifact_id, queryClient, apiUrl]);

  const handleDelete = useCallback(() => {
    setIsDeleting(true);
    clientRef.current.request(apiUrl, {
      method: 'DELETE',
      success: () => {
        addSuccessMessage(t('Snapshot deleted'));
        // TODO(preprod): Redirect to snapshot builds list once that UI is added
        navigate('/');
      },
      error: (resp: any) => {
        setIsDeleting(false);
        if (resp?.status === 403) {
          handleStaffPermissionError(resp?.responseJSON?.detail);
        } else {
          addErrorMessage(t('Failed to delete snapshot'));
        }
      },
    });
  }, [apiUrl, navigate]);

  return (
    <Flex align="center" gap="md">
      {data.approval_info &&
        (isApproved ? (
          <Flex align="center" gap="xl">
            <Tag variant="success" icon={<IconCheckmark />}>
              {t('Approved')}
            </Tag>
            {approvers.length > 0 && (
              <AvatarList users={approvers} avatarSize={24} maxVisibleAvatars={2} />
            )}
          </Flex>
        ) : (
          <Flex align="center" gap="sm">
            <Tag variant="warning" icon={<IconTimer />}>
              {t('Requires approval')}
            </Tag>
            <Button
              size="sm"
              priority="primary"
              icon={<IconThumb />}
              onClick={handleApprove}
              disabled={isApproving}
            >
              {t('Approve')}
            </Button>
          </Flex>
        ))}

      <ConfirmDelete
        message={t(
          'Are you sure you want to delete this snapshot? This action cannot be undone and will permanently remove all associated files and data.'
        )}
        confirmInput={data.head_artifact_id}
        onConfirm={handleDelete}
      >
        {({open: openDeleteModal}) => {
          const menuItems: MenuItemProps[] = [
            {
              key: 'rerun-status-checks',
              label: (
                <Flex align="center" gap="sm">
                  <IconRefresh size="sm" />
                  {t('Rerun Status Checks')}
                </Flex>
              ),
              onAction: handleRerunStatusChecks,
              textValue: t('Rerun Status Checks'),
            },
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
            },
          ];

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
                  onAction: handleRerunComparison,
                  textValue: t('Re-run comparison'),
                },
              ],
            });
          }

          return (
            <DropdownMenu
              items={menuItems}
              triggerProps={{
                size: 'sm',
                showChevron: false,
                icon: <IconEllipsis />,
                'aria-label': t('More actions'),
                disabled: isDeleting,
              }}
            />
          );
        }}
      </ConfirmDelete>
    </Flex>
  );
}

import {Fragment} from 'react';
import styled from '@emotion/styled';
import invariant from 'invariant';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {openConfirmModal} from 'sentry/components/confirm';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Duration from 'sentry/components/duration/duration';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {KeyValueData} from 'sentry/components/keyValueData';
import useReplayBulkDeleteAuditLog from 'sentry/components/replays/bulkDelete/useReplayBulkDeleteAuditLog';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconDelete} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import type {QueryKeyEndpointOptions} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import useDeleteReplays, {
  type ReplayBulkDeletePayload,
} from 'sentry/utils/replays/hooks/useDeleteReplays';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  queryOptions: QueryKeyEndpointOptions | undefined;
  replays: ReplayListRecord[];
  selectedIds: 'all' | string[];
}

export default function DeleteReplays({selectedIds, replays, queryOptions}: Props) {
  const analyticsArea = useAnalyticsArea();
  const {project: projectIds} = useLocationQuery({
    fields: {
      project: decodeList,
    },
  });

  const project = useProjectFromId({
    project_id: projectIds.length === 1 ? projectIds[0] : undefined,
  });
  const hasOneProjectSelected = Boolean(project);

  const {bulkDelete, hasAccess, queryOptionsToPayload} = useDeleteReplays({
    projectSlug: project?.slug ?? '',
  });
  const deletePayload = queryOptionsToPayload(selectedIds, queryOptions ?? {});

  const settingsPath = `/settings/projects/${project?.slug}/replays/?replaySettingsTab=bulk-delete`;

  const {refetch: refetchAuditLog} = useReplayBulkDeleteAuditLog({
    projectSlug: project?.slug ?? '',
    query: {referrer: analyticsArea},
  });

  return (
    <Tooltip
      disabled={hasOneProjectSelected}
      title={t('Select a single project from the dropdown to delete replays')}
    >
      <Tooltip
        disabled={!hasOneProjectSelected || hasAccess}
        title={t('You must have project:write or project:admin access to delete replays')}
      >
        <Button
          disabled={!hasOneProjectSelected || !hasAccess}
          icon={<IconDelete />}
          onClick={() =>
            openConfirmModal({
              bypass: selectedIds !== 'all' && selectedIds.length === 1,
              renderMessage: _props =>
                selectedIds === 'all' ? (
                  <ReplayQueryPreview deletePayload={deletePayload} project={project!} />
                ) : (
                  <ErrorBoundary mini>
                    <Title project={project!}>
                      {tn(
                        'The following %s replay will be deleted',
                        'The following %s replays will be deleted',
                        selectedIds.length
                      )}
                    </Title>
                    <ReplayPreviewTable replays={replays} selectedIds={selectedIds} />
                  </ErrorBoundary>
                ),
              renderConfirmButton: ({defaultOnClick}) => (
                <Button onClick={defaultOnClick} priority="danger">
                  {t('Delete')}
                </Button>
              ),
              onConfirm: () => {
                bulkDelete([deletePayload], {
                  onSuccess: () => {
                    addSuccessMessage(
                      tct('Replays are being deleted. [settings:View progress]', {
                        settings: <LinkWithUnderline to={settingsPath} />,
                      })
                    );
                    // TODO: get the list to refetch
                    refetchAuditLog();
                  },
                  onError: () =>
                    addErrorMessage(
                      tn(
                        'Failed to delete replay',
                        'Failed to delete replays',
                        selectedIds === 'all'
                          ? Number.MAX_SAFE_INTEGER
                          : selectedIds.length
                      )
                    ),
                  onSettled: () => {},
                });
              },
            })
          }
          size="xs"
        >
          {t('Delete')}
        </Button>
      </Tooltip>
    </Tooltip>
  );
}

function ReplayQueryPreview({
  deletePayload,
  project,
}: {
  deletePayload: ReplayBulkDeletePayload;
  project: Project;
}) {
  const contentItems = Object.entries(deletePayload).map(([key, value]) => ({
    item: {
      key,
      subject: key,
      value,
    },
  }));
  return (
    <Fragment>
      <Title project={project}>
        {t('Replays matching the following query will be deleted')}
      </Title>
      <KeyValueData.Card contentItems={contentItems} />
    </Fragment>
  );
}

function ReplayPreviewTable({
  replays,
  selectedIds,
}: {
  replays: ReplayListRecord[];
  selectedIds: string[];
}) {
  return (
    <SimpleTableWithTwoColumns>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Replay')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Duration')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {selectedIds.map(id => {
        const replay = replays.find(r => r.id === id) as ReplayListRecord;
        if (replay.is_archived) {
          return null;
        }
        invariant(
          replay.duration && replay.started_at,
          'For TypeScript: replay.duration and replay.started_at are implied because replay.is_archived is false'
        );

        return (
          <SimpleTable.Row key={id}>
            <SimpleTable.RowCell>
              <Flex key="session" align="center" gap="md">
                <UserAvatar
                  user={{
                    username: replay.user?.display_name || '',
                    email: replay.user?.email || '',
                    id: replay.user?.id || '',
                    ip_address: replay.user?.ip || '',
                    name: replay.user?.username || '',
                  }}
                  size={24}
                />
                <SubText>
                  <Flex gap="xs" align="flex-start">
                    <DisplayName>
                      {replay.user.display_name || t('Anonymous User')}
                    </DisplayName>
                  </Flex>
                  <Flex gap="xs">
                    {getShortEventId(replay.id)}
                    <Flex gap="xs">
                      <IconCalendar color="gray300" size="xs" />
                      <TimeSince date={replay.started_at} />
                    </Flex>
                  </Flex>
                </SubText>
              </Flex>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="flex-end">
              <Duration
                duration={[replay.duration.asMilliseconds() ?? 0, 'ms']}
                precision="sec"
              />
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
    </SimpleTableWithTwoColumns>
  );
}

function Title({children, project}: {children: React.ReactNode; project: Project}) {
  const settingsPath = `/settings/projects/${project.slug}/replays/?replaySettingsTab=bulk-delete`;
  return (
    <Fragment>
      <p>
        <strong>{children}</strong>
      </p>
      <p>
        {tct('You can track the progress in [link].', {
          link: (
            <LinkWithUnderline
              to={settingsPath}
            >{`Settings > ${project.slug} > Replays`}</LinkWithUnderline>
          ),
        })}
      </p>
    </Fragment>
  );
}

const SimpleTableWithTwoColumns = styled(SimpleTable)`
  grid-template-columns: 1fr max-content;

  max-height: calc(100vh - 315px);
  min-height: 200px;
  overflow-y: auto;

  & > div:first-child {
    position: sticky;
    top: 0;
    z-index: 1;
  }
`;

const SubText = styled('div')`
  font-size: 0.875em;
  line-height: normal;
  color: ${p => p.theme.subText};
  ${p => p.theme.overflowEllipsis};
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  align-items: flex-start;
`;

const DisplayName = styled('span')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: normal;
  ${p => p.theme.overflowEllipsis};
`;

const LinkWithUnderline = styled(Link)`
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`;

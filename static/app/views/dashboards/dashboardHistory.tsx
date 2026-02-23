import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {makeDashboardHistoryQueryKey} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClock} from 'sentry/icons/iconClock';
import {t, tn} from 'sentry/locale';
import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

import {useDashboardHistory} from './hooks/useDashboardHistory';
import type {DashboardDetails} from './types';

interface DashboardHistoryButtonProps {
  dashboard: DashboardDetails;
  onRestore: (restoredDashboard: DashboardDetails) => void;
}

export default function DashboardHistoryButton({
  dashboard,
  onRestore,
}: DashboardHistoryButtonProps) {
  const {openDrawer} = useDrawer();
  const organization = useOrganization();

  const isValidDashboard =
    !!dashboard.id && dashboard.id !== 'default-overview' && !dashboard.prebuiltId;

  const {data: history} = useDashboardHistory({
    dashboardId: dashboard.id,
    enabled: isValidDashboard,
  });

  const hasHistory = (history?.length ?? 0) > 0;

  const handleClick = useCallback(() => {
    openDrawer(
      ({closeDrawer}) => (
        <DashboardHistoryDrawerContent
          dashboardId={dashboard.id}
          orgSlug={organization.slug}
          onRestore={restoredDashboard => {
            onRestore(restoredDashboard);
            closeDrawer();
          }}
        />
      ),
      {ariaLabel: t('Dashboard History')}
    );
  }, [openDrawer, dashboard.id, organization.slug, onRestore]);

  if (!isValidDashboard) {
    return null;
  }

  return (
    <Tooltip
      title={
        hasHistory
          ? t('Dashboard History')
          : t('No history yet. History is recorded when the dashboard is edited.')
      }
    >
      <Button
        size="sm"
        icon={<IconClock />}
        aria-label={t('Dashboard History')}
        onClick={handleClick}
        disabled={!hasHistory}
      />
    </Tooltip>
  );
}

function DashboardHistoryDrawerContent({
  dashboardId,
  orgSlug,
  onRestore,
}: {
  dashboardId: string;
  onRestore: (restoredDashboard: DashboardDetails) => void;
  orgSlug: string;
}) {
  const queryClient = useQueryClient();
  const {data: history, isPending} = useDashboardHistory({dashboardId});

  const {mutate: restoreSnapshot, isPending: isRestoring} = useMutation<
    DashboardDetails,
    RequestError,
    {historyId: string}
  >({
    mutationFn: ({historyId}) =>
      fetchMutation({
        url: `/organizations/${orgSlug}/dashboards/${dashboardId}/history/${historyId}/restore/`,
        method: 'POST',
      }),
    onSuccess: restored => {
      queryClient.invalidateQueries({
        queryKey: makeDashboardHistoryQueryKey(orgSlug, dashboardId),
      });
      addSuccessMessage(t('Dashboard restored successfully'));
      onRestore(restored);
    },
    onError: () => {
      addErrorMessage(t('Unable to restore dashboard'));
    },
  });

  return (
    <Fragment>
      <DrawerHeader>
        <Flex align="center" justify="center">
          {t('Dashboard History')}
        </Flex>
      </DrawerHeader>
      <DrawerBody>
        <HistoryDescription>
          {t(
            'Restore to a previous snapshot of the dashboard. Up to 10 snapshots are stored and created on each dashboard edit, deleting the oldest snapshots first when the limit is reached.'
          )}
        </HistoryDescription>
        {isPending ? (
          <LoadingIndicator />
        ) : history?.length === 0 ? (
          <p>
            {t(
              'No history entries yet. History is recorded when the dashboard is edited.'
            )}
          </p>
        ) : (
          <HistoryList>
            {history?.map(entry => (
              <HistoryItem key={entry.id}>
                <HistoryInfo>
                  <HistoryTitleRow>
                    <HistoryTitle>{entry.title}</HistoryTitle>
                    {entry.source === 'restore' && (
                      <Badge variant="warning">{t('pre-restore')}</Badge>
                    )}
                  </HistoryTitleRow>
                  <HistoryMeta>
                    {new Date(entry.dateAdded).toLocaleString()}
                    {' \u00b7 '}
                    {tn('%s widget', '%s widgets', entry.widgetCount)}
                    {entry.createdBy && (
                      <span>
                        {' \u00b7 '}
                        {entry.createdBy.name || entry.createdBy.email}
                      </span>
                    )}
                  </HistoryMeta>
                </HistoryInfo>
                <Button
                  size="xs"
                  onClick={() => restoreSnapshot({historyId: entry.id})}
                  disabled={isRestoring}
                >
                  {t('Restore')}
                </Button>
              </HistoryItem>
            ))}
          </HistoryList>
        )}
      </DrawerBody>
    </Fragment>
  );
}

const HistoryDescription = styled('p')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  margin-bottom: ${p => p.theme.space.md};
`;

const HistoryList = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const HistoryItem = styled('li')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.md} 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  &:last-child {
    border-bottom: none;
  }
`;

const HistoryInfo = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  min-width: 0;
`;

const HistoryTitleRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const HistoryTitle = styled('span')`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HistoryMeta = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

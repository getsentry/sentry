import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  fetchDashboardHistory,
  restoreDashboardSnapshot,
  type DashboardHistoryEntry,
} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClock} from 'sentry/icons/iconClock';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

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

  // Don't show for new/unsaved/prebuilt dashboards
  if (!dashboard.id || dashboard.id === 'default-overview' || dashboard.prebuiltId) {
    return null;
  }

  return (
    <Tooltip title={t('Dashboard History')}>
      <Button
        size="sm"
        icon={<IconClock />}
        aria-label={t('Dashboard History')}
        onClick={handleClick}
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
  const api = useApi();
  const [history, setHistory] = useState<DashboardHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardHistory(api, orgSlug, dashboardId).then(
      data => {
        if (!cancelled) {
          setHistory(data);
          setIsLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [api, orgSlug, dashboardId]);

  async function handleRestore(historyId: string) {
    try {
      setRestoringId(historyId);
      const restored = await restoreDashboardSnapshot(
        api,
        orgSlug,
        dashboardId,
        historyId
      );
      addSuccessMessage(t('Dashboard restored successfully'));
      onRestore(restored);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Fragment>
      <DrawerHeader>
        <Flex align="center" justify="center">
          {t('Dashboard History')}
        </Flex>
      </DrawerHeader>
      <DrawerBody>
        {isLoading ? (
          <LoadingIndicator />
        ) : history.length === 0 ? (
          <p>
            {t(
              'No history entries yet. History is recorded when the dashboard is edited.'
            )}
          </p>
        ) : (
          <HistoryList>
            {history.map(entry => (
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
                  onClick={() => handleRestore(entry.id)}
                  disabled={restoringId !== null}
                  busy={restoringId === entry.id}
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

const HistoryList = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const HistoryItem = styled('li')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1.5)} 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  &:last-child {
    border-bottom: none;
  }
`;

const HistoryInfo = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  min-width: 0;
`;

const HistoryTitleRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
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

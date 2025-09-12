import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Text} from 'sentry/components/core/text/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconRefresh, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

import SnapshotDiffImageList from './snapshotDiffImageList';
import SnapshotSingleImageList from './snapshotSingleImageList';
import type {Snapshot, SnapshotDiffResponse} from './types';

type TabType = 'added' | 'removed' | 'changed' | 'unchanged' | 'errors';

const TAB_ORDER: TabType[] = ['added', 'removed', 'changed', 'unchanged', 'errors'];
const TAB_COUNT_KEYS: Record<TabType, keyof SnapshotDiffResponse> = {
  added: 'addedCount',
  removed: 'removedCount',
  changed: 'changedCount',
  unchanged: 'unchangedCount',
  errors: 'errorsCount',
};

function SnapshotTesting() {
  const [activeTab, setActiveTab] = useState<TabType>('changed');

  const organization = useOrganization();

  // Hardcoded upload IDs - replace with your actual values
  const HEAD_UPLOAD_ID = 'c19e3da0-5f6f-46fc-a6bc-cf63b89f889f';
  // const BASE_UPLOAD_ID = 'base-upload-id-here';

  const snapshotDataQuery: UseApiQueryResult<SnapshotDiffResponse, RequestError> =
    useApiQuery<SnapshotDiffResponse>(
      [
        `/organizations/${organization.slug}/emerge-snapshots/?headUploadId=${HEAD_UPLOAD_ID}&tab=${activeTab}`,
      ],
      {
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        enabled: !!HEAD_UPLOAD_ID,
      }
    );

  // Set activeTab to the first tab with non-0 snapshots once data is loaded
  useEffect(() => {
    if (snapshotDataQuery.data) {
      for (const tab of TAB_ORDER) {
        const countKey = TAB_COUNT_KEYS[tab];
        const count = snapshotDataQuery.data[countKey];
        if (typeof count === 'number' && count > 0) {
          if (activeTab !== tab) {
            setActiveTab(tab);
          }
          return;
        }
      }
      // If all counts are 0, default to 'changed'
      if (activeTab !== 'changed') {
        setActiveTab('changed');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotDataQuery.data]);

  const tabData = useMemo(() => {
    if (!snapshotDataQuery.data) return [];
    switch (activeTab) {
      case 'added':
        return snapshotDataQuery.data.added;
      case 'removed':
        return snapshotDataQuery.data.removed;
      case 'changed':
        return snapshotDataQuery.data.changed;
      case 'unchanged':
        return snapshotDataQuery.data.unchanged;
      case 'errors':
        return snapshotDataQuery.data.errors;
      default:
        return [];
    }
  }, [snapshotDataQuery.data, activeTab]);

  if (snapshotDataQuery.isLoading && !snapshotDataQuery.data) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingIndicator />
          <Text variant="muted">{t('Loading snapshot data...')}</Text>
        </LoadingContainer>
      </Container>
    );
  }

  if (snapshotDataQuery.error) {
    return (
      <Container>
        <ErrorContainer>
          <Flex align="center" gap="md">
            <IconWarning color="red300" />
            <Text color="red300">{snapshotDataQuery.error.message}</Text>
          </Flex>
          <Button
            size="sm"
            onClick={() => snapshotDataQuery.refetch()}
            icon={<IconRefresh />}
          >
            {t('Retry')}
          </Button>
        </ErrorContainer>
      </Container>
    );
  }

  return (
    <Container>
      <ContentSection>
        <ControlsSection>
          <SegmentedControl
            aria-label={t('Snapshot category')}
            value={activeTab}
            onChange={setActiveTab}
          >
            <SegmentedControl.Item key="added">
              {t('Added')}{' '}
              {snapshotDataQuery.data?.addedCount
                ? `(${snapshotDataQuery.data.addedCount})`
                : ''}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="removed">
              {t('Removed')}{' '}
              {snapshotDataQuery.data?.removedCount
                ? `(${snapshotDataQuery.data.removedCount})`
                : ''}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="changed">
              {t('Modified')}{' '}
              {snapshotDataQuery.data?.changedCount
                ? `(${snapshotDataQuery.data.changedCount})`
                : ''}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="unchanged">
              {t('Unchanged')}{' '}
              {snapshotDataQuery.data?.unchangedCount
                ? `(${snapshotDataQuery.data.unchangedCount})`
                : ''}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="errors">
              {t('Errors')}{' '}
              {snapshotDataQuery.data?.errorsCount
                ? `(${snapshotDataQuery.data.errorsCount})`
                : ''}
            </SegmentedControl.Item>
          </SegmentedControl>
        </ControlsSection>

        <ContentPanel>
          {activeTab === 'unchanged' ? (
            <SnapshotSingleImageList snapshots={tabData as Snapshot[]} />
          ) : (
            <SnapshotDiffImageList diffs={tabData} />
          )}
        </ContentPanel>
      </ContentSection>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ContentSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
`;

const ControlsSection = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${p => p.theme.space.md} 0;
`;

const ContentPanel = styled('div')`
  flex: 1;
`;

const LoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.lg};
  gap: ${p => p.theme.space.md};
`;

const ErrorContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.lg};
  gap: ${p => p.theme.space.md};
  background: ${p => p.theme.red100};
  border: 1px solid ${p => p.theme.red200};
  border-radius: 6px;
`;

export default SnapshotTesting;

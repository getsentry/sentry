import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconRefresh, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

// Types for Emerge Tools API
interface SnapshotDiff {
  id: string;
  name: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged' | 'error';
  baseImageUrl?: string;
  diffImageUrl?: string;
  diffPercentage?: number;
  headImageUrl?: string;
  metadata?: {
    height: number;
    platform: string;
    width: number;
  };
}

interface SnapshotDiffResponse {
  added: SnapshotDiff[];
  addedCount: number;
  changed: SnapshotDiff[];
  changedCount: number;
  errors: SnapshotDiff[];
  errorsCount: number;
  removed: SnapshotDiff[];
  removedCount: number;
  status: 'processing' | 'success' | 'error';
  unchanged: SnapshotDiff[];
  unchangedCount: number;
  baseUploadMetadata?: {
    name: string;
    sha: string;
    version: string;
  };
  headUploadMetadata?: {
    name: string;
    sha: string;
    version: string;
  };
  message?: string;
}

type TabType = 'added' | 'removed' | 'changed' | 'unchanged' | 'errors';

interface SnapshotTestingProps {
  prId: string;
  repoName: string;
}

function SnapshotTesting({prId, repoName}: SnapshotTestingProps) {
  const [activeTab, setActiveTab] = useState<TabType>('changed');
  const [searchQuery, setSearchQuery] = useState('');

  const organization = useOrganization();

  // Hardcoded upload IDs - replace with your actual values
  const HEAD_UPLOAD_ID = 'c19e3da0-5f6f-46fc-a6bc-cf63b89f889f';
  // const BASE_UPLOAD_ID = 'base-upload-id-here';

  const snapshotDataQuery: UseApiQueryResult<SnapshotDiffResponse, RequestError> =
    useApiQuery<SnapshotDiffResponse>(
      [
        `/organizations/${organization.slug}/emerge-snapshots/?headUploadId=${HEAD_UPLOAD_ID}&tab=${activeTab}&search=${searchQuery}`,
      ],
      {
        staleTime: 0,
        enabled: !!HEAD_UPLOAD_ID,
      }
    );

  const getTabData = () => {
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
  };

  const tabData = getTabData();

  if (snapshotDataQuery.isLoading && !snapshotDataQuery.data) {
    return (
      <Container>
        <HeaderSection>
          <Heading as="h2" size="lg">
            {t('Snapshot Testing')}
          </Heading>
          <Text variant="muted">
            {t('Visual regression testing results for PR #%s in %s', prId, repoName)}
          </Text>
        </HeaderSection>
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
        <HeaderSection>
          <Heading as="h2" size="lg">
            {t('Snapshot Testing')}
          </Heading>
          <Text variant="muted">
            {t('Visual regression testing results for PR #%s in %s', prId, repoName)}
          </Text>
        </HeaderSection>
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
      <HeaderSection>
        <Heading as="h2" size="lg">
          {t('Snapshot Testing')}
        </Heading>
        <Text variant="muted">
          {t('Visual regression testing results for PR #%s in %s', prId, repoName)}
        </Text>
        {snapshotDataQuery.data?.headUploadMetadata && (
          <MetadataRow>
            <Text size="sm" variant="muted">
              <strong>{t('Head:')} </strong>
              {snapshotDataQuery.data.headUploadMetadata.name} (
              {snapshotDataQuery.data.headUploadMetadata.version})
            </Text>
            {snapshotDataQuery.data.baseUploadMetadata && (
              <Text size="sm" variant="muted">
                <strong>{t('Base:')} </strong>
                {snapshotDataQuery.data.baseUploadMetadata.name} (
                {snapshotDataQuery.data.baseUploadMetadata.version})
              </Text>
            )}
          </MetadataRow>
        )}
      </HeaderSection>

      <ContentSection>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <TabList>
            <TabList.Item key="added">
              {t('Added')}{' '}
              {snapshotDataQuery.data?.addedCount
                ? `(${snapshotDataQuery.data.addedCount})`
                : ''}
            </TabList.Item>
            <TabList.Item key="removed">
              {t('Removed')}{' '}
              {snapshotDataQuery.data?.removedCount
                ? `(${snapshotDataQuery.data.removedCount})`
                : ''}
            </TabList.Item>
            <TabList.Item key="changed">
              {t('Modified')}{' '}
              {snapshotDataQuery.data?.changedCount
                ? `(${snapshotDataQuery.data.changedCount})`
                : ''}
            </TabList.Item>
            <TabList.Item key="unchanged">
              {t('Unchanged')}{' '}
              {snapshotDataQuery.data?.unchangedCount
                ? `(${snapshotDataQuery.data.unchangedCount})`
                : ''}
            </TabList.Item>
            <TabList.Item key="errors">
              {t('Errors')}{' '}
              {snapshotDataQuery.data?.errorsCount
                ? `(${snapshotDataQuery.data.errorsCount})`
                : ''}
            </TabList.Item>
          </TabList>

          <SearchContainer>
            <SearchInput
              type="text"
              placeholder={t('Search snapshots...')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </SearchContainer>

          <TabPanels>
            <TabPanels.Item key="added">
              <SnapshotGrid snapshots={tabData} />
            </TabPanels.Item>
            <TabPanels.Item key="removed">
              <SnapshotGrid snapshots={tabData} />
            </TabPanels.Item>
            <TabPanels.Item key="changed">
              <SnapshotGrid snapshots={tabData} showDiff />
            </TabPanels.Item>
            <TabPanels.Item key="unchanged">
              <SnapshotGrid snapshots={tabData} />
            </TabPanels.Item>
            <TabPanels.Item key="errors">
              <SnapshotGrid snapshots={tabData} />
            </TabPanels.Item>
          </TabPanels>
        </Tabs>
      </ContentSection>
    </Container>
  );
}

function SnapshotGrid({
  snapshots,
  showDiff = false,
}: {
  snapshots: SnapshotDiff[];
  showDiff?: boolean;
}) {
  if (!snapshots.length) {
    return (
      <EmptyState>
        <Text variant="muted">{t('No snapshots found')}</Text>
      </EmptyState>
    );
  }

  return (
    <Grid>
      {snapshots.map(snapshot => (
        <SnapshotCard key={snapshot.id}>
          <SnapshotHeader>
            <Text size="sm" weight="bold" truncate>
              {snapshot.name}
            </Text>
            {snapshot.status === 'changed' && snapshot.diffPercentage && (
              <DiffBadge>
                {snapshot.diffPercentage.toFixed(1)}% {t('diff')}
              </DiffBadge>
            )}
          </SnapshotHeader>

          <ImageContainer>
            {showDiff && snapshot.status === 'changed' ? (
              <DiffImageContainer>
                {snapshot.baseImageUrl && (
                  <ImageWrapper>
                    <ImageLabel>{t('Before')}</ImageLabel>
                    <SnapshotImage
                      src={snapshot.baseImageUrl}
                      alt={`${snapshot.name} before`}
                    />
                  </ImageWrapper>
                )}
                {snapshot.headImageUrl && (
                  <ImageWrapper>
                    <ImageLabel>{t('After')}</ImageLabel>
                    <SnapshotImage
                      src={snapshot.headImageUrl}
                      alt={`${snapshot.name} after`}
                    />
                  </ImageWrapper>
                )}
                {snapshot.diffImageUrl && (
                  <ImageWrapper>
                    <ImageLabel>{t('Diff')}</ImageLabel>
                    <SnapshotImage
                      src={snapshot.diffImageUrl}
                      alt={`${snapshot.name} diff`}
                    />
                  </ImageWrapper>
                )}
              </DiffImageContainer>
            ) : (
              snapshot.headImageUrl && (
                <SnapshotImage src={snapshot.headImageUrl} alt={snapshot.name} />
              )
            )}
          </ImageContainer>

          {snapshot.metadata && (
            <SnapshotMetadata>
              <Text size="xs" variant="muted">
                {snapshot.metadata.width}×{snapshot.metadata.height} •{' '}
                {snapshot.metadata.platform}
              </Text>
            </SnapshotMetadata>
          )}
        </SnapshotCard>
      ))}
    </Grid>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${p => p.theme.space['3xl']};
  gap: ${space(3)};
`;

const HeaderSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const MetadataRow = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
`;

const ContentSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const LoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${space(4)};
  gap: ${space(2)};
`;

const ErrorContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${space(4)};
  gap: ${space(2)};
  background: ${p => p.theme.red100};
  border: 1px solid ${p => p.theme.red200};
  border-radius: 6px;
`;

const SearchContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin: ${space(2)} 0;
`;

const SearchInput = styled('input')`
  width: 300px;
  padding: ${space(1)} ${space(1.5)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  font-size: ${p => p.theme.fontSizeMedium};
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  &:focus {
    outline: none;
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 0 0 1px ${p => p.theme.purple300};
  }

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

const EmptyState = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(4)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  background: ${p => p.theme.backgroundSecondary};
`;

const Grid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  padding: ${space(2)} 0;
`;

const SnapshotCard = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  padding: ${space(2)};
  transition: box-shadow 0.2s ease-in-out;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const SnapshotHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1.5)};
`;

const DiffBadge = styled('span')`
  background: ${p => p.theme.yellow100};
  color: ${p => p.theme.yellow400};
  padding: ${space(0.5)} ${space(1)};
  border-radius: 12px;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: 600;
`;

const ImageContainer = styled('div')`
  margin-bottom: ${space(1.5)};
`;

const DiffImageContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: ${space(1)};
`;

const ImageWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const ImageLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: 600;
  color: ${p => p.theme.subText};
  text-align: center;
`;

const SnapshotImage = styled('img')`
  width: 100%;
  height: auto;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid ${p => p.theme.border};
`;

const SnapshotMetadata = styled('div')`
  text-align: center;
  border-top: 1px solid ${p => p.theme.border};
  padding-top: ${space(1)};
`;

export default SnapshotTesting;

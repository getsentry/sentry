import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {Badge} from 'sentry/components/core/badge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildError} from 'sentry/views/preprod/components/buildError';

interface ShardData {
  key: string;
  shardIndex: number;
  uploaded: boolean;
  contentType?: string;
  size?: number;
}

interface ImageData {
  colorScheme: string;
  group: string;
  height: number;
  id: string;
  key: string;
  title: string;
  width: number;
}

interface SnapshotResponse {
  allUploaded: boolean;
  images: ImageData[];
  numShards: number;
  pagination: {
    hasNext: boolean;
    limit: number;
    offset: number;
    total: number;
  };
  shards: ShardData[];
  snapshotId: string;
  uploadedShards: number;
}

export default function SnapshotViewer() {
  const organization = useOrganization();
  const params = useParams<{projectId: string; snapshotId: string}>();
  const {projectId, snapshotId} = params;

  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);

  const snapshotQuery: UseApiQueryResult<SnapshotResponse, RequestError> =
    useApiQuery<SnapshotResponse>(
      [
        `/projects/${organization.slug}/${projectId}/preprodartifacts/snapshots/`,
        {
          query: {
            snapshotId,
            offset: offset.toString(),
            limit: limit.toString(),
          },
        },
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!snapshotId,
      }
    );

  const handleNextPage = () => {
    if (snapshotQuery.data?.pagination.hasNext) {
      setOffset(offset + limit);
    }
  };

  const handlePrevPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const title = t('Snapshot Viewer: %s', snapshotId);

  if (snapshotQuery.isError) {
    return (
      <SentryDocumentTitle title={title}>
        <Layout.Page>
          <BuildError
            title={t('Snapshot unavailable')}
            message={
              typeof snapshotQuery.error?.responseJSON?.error === 'string'
                ? snapshotQuery.error?.responseJSON.error
                : t('Unable to load snapshot data')
            }
          />
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  if (snapshotQuery.isLoading) {
    return (
      <SentryDocumentTitle title={title}>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{title}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main>
              <LoadingIndicator />
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  const data = snapshotQuery.data;

  return (
    <SentryDocumentTitle title={title}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{title}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main>
            {data && (
              <Fragment>
                <StatusAlert type={data.allUploaded ? 'success' : 'info'} showIcon>
                  {data.allUploaded
                    ? tct('All [total] shards have been uploaded successfully!', {
                        total: data.numShards,
                      })
                    : tct('Upload in progress: [uploaded] of [total] shards uploaded', {
                        uploaded: data.uploadedShards,
                        total: data.numShards,
                      })}
                </StatusAlert>

                {data.images.length === 0 ? (
                  <EmptyState>{t('No images found')}</EmptyState>
                ) : (
                  <Fragment>
                    {Object.entries(
                      data.images.reduce(
                        (groups, image) => {
                          const group = image.group;
                          if (!groups[group]) {
                            groups[group] = [];
                          }
                          groups[group].push(image);
                          return groups;
                        },
                        {} as Record<string, ImageData[]>
                      )
                    ).map(([groupName, images]) => (
                      <GroupSection key={groupName}>
                        <GroupTitle>{groupName}</GroupTitle>
                        <ImageGrid>
                          {images.map(image => {
                            const imageUrl = `/api/0/projects/${organization.slug}/${projectId}/files/images/${image.key}/`;
                            return (
                              <ImageCard key={image.id}>
                                <ImageCardHeader>
                                  <ImageTitle>{image.title}</ImageTitle>
                                </ImageCardHeader>
                                <ImageContainer darkMode={image.colorScheme === 'dark'}>
                                  <StyledImage
                                    src={imageUrl}
                                    alt={image.title}
                                    loading="lazy"
                                  />
                                </ImageContainer>
                                <ImageCardFooter>
                                  <ImageMeta>
                                    {image.colorScheme === 'dark' && (
                                      <Badge type="default">{t('Dark')}</Badge>
                                    )}
                                    <MetaText>
                                      {image.width} × {image.height}
                                    </MetaText>
                                  </ImageMeta>
                                  <ImageId>{image.id}</ImageId>
                                </ImageCardFooter>
                              </ImageCard>
                            );
                          })}
                        </ImageGrid>
                      </GroupSection>
                    ))}
                  </Fragment>
                )}

                <PaginationWrapper>
                  <PaginationInfo>
                    {tct('Showing [start]-[end] of [total] images', {
                      start: data.pagination.total === 0 ? 0 : offset + 1,
                      end: Math.min(offset + limit, data.pagination.total),
                      total: data.pagination.total,
                    })}
                  </PaginationInfo>
                  <PaginationButtons>
                    <Button
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={offset === 0}
                      aria-label={t('Previous page')}
                    >
                      {t('Previous')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!data.pagination.hasNext}
                      aria-label={t('Next page')}
                    >
                      {t('Next')}
                    </Button>
                  </PaginationButtons>
                </PaginationWrapper>
              </Fragment>
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const StatusAlert = styled(Alert)`
  margin-bottom: ${space(2)};
`;

const GroupSection = styled('div')`
  margin-bottom: ${space(4)};
`;

const GroupTitle = styled('h2')`
  margin: 0 0 ${space(3)} 0;
  font-size: ${p => p.theme.font.size.xl};
  font-weight: ${p => p.theme.font.weight.medium};
  color: ${p => p.theme.gray500};
  padding-bottom: ${space(2)};
  border-bottom: 2px solid ${p => p.theme.border};
`;

const ImageGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: ${space(3)};
`;

const ImageCard = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const ImageCardHeader = styled('div')`
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ImageTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.medium};
  color: ${p => p.theme.gray500};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ImageContainer = styled('div')<{darkMode: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(3)};
  background: ${p => (p.darkMode ? p.theme.gray500 : p.theme.gray100)};
  min-height: 300px;
`;

const StyledImage = styled('img')`
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 4px;
`;

const ImageCardFooter = styled('div')`
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ImageMeta = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1.5)};
`;

const MetaText = styled('span')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.subText};
`;

const ImageId = styled('code')`
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.subText};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.gray100};
  border-radius: 3px;
`;

const EmptyState = styled('div')`
  text-align: center;
  color: ${p => p.theme.subText};
  padding: ${space(4)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 8px;
`;

const PaginationWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${space(2)};
`;

const PaginationInfo = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.font.size.sm};
`;

const PaginationButtons = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

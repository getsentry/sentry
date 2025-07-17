import React, {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayView from 'sentry/components/replays/replayView';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReplayDetailsProviders from 'sentry/views/replays/detail/body/replayDetailsProviders';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplaySearchBar from 'sentry/views/replays/list/replaySearchBar';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

export default function SelectReplayPage() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation<ReplayListLocationQuery>();
  const [selectedReplay, setSelectedReplay] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const query = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      end: decodeScalar,
      environment: decodeList,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });

  // Create an EventView for fetching replays
  const eventView = useMemo(() => {
    const combinedQuery = [query.query, searchQuery].filter(Boolean).join(' ');
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: [
        'id',
        'started_at',
        'finished_at',
        'duration',
        'user',
        'project_id',
        'urls',
      ],
      projects: selection.projects.map(Number),
      query: combinedQuery || '',
      orderby: '-started_at',
      environment: query.environment || selection.environments,
      range: query.statsPeriod,
      start: query.start,
      end: query.end,
      utc: query.utc === 'true',
    });
  }, [
    query.query,
    query.environment,
    query.statsPeriod,
    query.start,
    query.end,
    query.utc,
    searchQuery,
    selection.projects,
    selection.environments,
  ]);

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
    queryReferrer: 'replayList',
    perPage: 20,
  });

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!selectedReplay) {
        addErrorMessage(t('Please select a replay'));
        return;
      }
      setIsSubmitting(true);
      addLoadingMessage();

      try {
        navigate(
          `/codecov/flows/select-start-end?replay=${encodeURIComponent(selectedReplay)}`
        );
        setSelectedReplay(null);
      } catch (error) {
        const message = t('Failed to access replay.');
        addErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedReplay, navigate]
  );

  const handleCancel = useCallback(() => {
    navigate('/codecov/flows/');
    setSelectedReplay(null);
  }, [navigate]);

  const isFormValid = !!selectedReplay;

  return (
    <SentryDocumentTitle title={t('Select Replay')}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs
                crumbs={[
                  {
                    label: t('Flows'),
                    to: '/codecov/flows/',
                  },
                  {
                    label: t('Select Replay'),
                  },
                ]}
              />
              <Layout.Title>{t('Select Replay')}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>

          <Layout.Body>
            <Layout.Main fullWidth>
              <TwoColumnContainer>
                <LeftColumn>
                  <List symbol="colored-numeric">
                    <ListItem
                      style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        marginBottom: 12,
                        listStyle: 'none',
                      }}
                    >
                      {t('Select a replay to use as the basis for your new flow.')}
                    </ListItem>
                  </List>
                  <ReplaySearchBar
                    organization={organization}
                    pageFilters={selection}
                    defaultQuery=""
                    query={searchQuery}
                    onSearch={setSearchQuery}
                  />
                  <ReplaysFilters />
                  <ReplayListScrollContainer>
                    {isFetching ? (
                      <LoadingIndicator />
                    ) : fetchError || !replays || replays.length === 0 ? (
                      <EmptyStateWarning withIcon={false} small>
                        {t('No replays found')}
                      </EmptyStateWarning>
                    ) : (
                      <SelectReplayList
                        replays={replays}
                        selectedReplay={selectedReplay}
                        setSelectedReplay={setSelectedReplay}
                      />
                    )}
                  </ReplayListScrollContainer>
                  <ButtonContainer>
                    <Button priority="default" onClick={handleCancel} type="button">
                      {t('Cancel')}
                    </Button>
                    <Button
                      priority="primary"
                      disabled={isSubmitting || !isFormValid}
                      onClick={handleSubmit}
                      type="button"
                    >
                      {isSubmitting ? t('Loading...') : t('Select Replay')}
                    </Button>
                  </ButtonContainer>
                </LeftColumn>

                <RightColumn>
                  {selectedReplay && (
                    <SelectReplayPreview
                      replaySlug={selectedReplay}
                      orgSlug={organization.slug}
                    />
                  )}
                </RightColumn>
              </TwoColumnContainer>
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function SelectReplayList({
  replays,
  selectedReplay,
  setSelectedReplay,
}: {
  replays: ReplayListRecord[];
  selectedReplay: string | null;
  setSelectedReplay: (replay: string | null) => void;
}) {
  return (
    <div>
      {replays.map(replayItem => {
        const isSelected = selectedReplay === replayItem.id;
        let pathname = t('Unknown URL');
        if (replayItem.urls?.[0]) {
          try {
            pathname = new URL(replayItem.urls[0]).pathname;
          } catch {
            pathname = replayItem.urls[0] || t('Unknown URL');
          }
        }
        const MAX_LENGTH = 40;
        if (pathname.length > MAX_LENGTH) {
          pathname = pathname.slice(0, MAX_LENGTH) + '...';
        }
        const user =
          replayItem.user?.display_name || replayItem.user?.email || t('Unknown');
        const duration =
          replayItem.duration && typeof replayItem.duration.asSeconds === 'function'
            ? Math.round(replayItem.duration.asSeconds())
            : 0;
        const startedAt =
          replayItem.started_at &&
          typeof replayItem.started_at.toLocaleString === 'function'
            ? replayItem.started_at.toLocaleString()
            : t('Unknown time');

        return (
          <div
            key={replayItem.id}
            onClick={() => setSelectedReplay(replayItem.id)}
            style={{
              padding: '12px',
              border: `2px solid ${isSelected ? '#6366f1' : '#e5e7eb'}`,
              borderRadius: '8px',
              marginBottom: '8px',
              cursor: 'pointer',
              backgroundColor: isSelected ? '#f3f4f6' : 'white',
              transition: 'all 0.2s ease',
            }}
            data-test-id={`replay-row-${replayItem.id}`}
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                setSelectedReplay(replayItem.id);
              }
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{flex: 1}}>
                <div style={{fontWeight: 600, marginBottom: '4px'}}>{pathname}</div>
                <div style={{fontSize: '12px', color: '#6b7280', marginBottom: '4px'}}>
                  {t('User')}: {user}
                </div>
                <div style={{fontSize: '12px', color: '#6b7280', marginBottom: '4px'}}>
                  {t('Duration')}: {duration}s
                </div>
                <div style={{fontSize: '12px', color: '#6b7280'}}>{startedAt}</div>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                  fontFamily: 'monospace',
                }}
              >
                {replayItem?.id?.substring(0, 8) || 'Unknown'}...
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SelectReplayPreview({
  replaySlug,
  orgSlug,
}: {
  orgSlug: string;
  replaySlug: string;
}) {
  const {replay, replayRecord, isError, isPending} = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });

  return (
    <PreviewContainer>
      <PreviewTitle>{t('Replay Preview')}</PreviewTitle>
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <EmptyStateWarning withIcon={false} small>
          {t('Error loading replay')}
        </EmptyStateWarning>
      ) : replay ? (
        <ReplayDetailsProviders
          replay={replay}
          projectSlug={replayRecord?.project_id || ''}
        >
          <PreviewContent>
            <ReplayView isLoading={isPending} toggleFullscreen={() => {}} />
            <ReplayController
              isLoading={isPending}
              hideFastForward={false}
              toggleFullscreen={() => {}}
            />
          </PreviewContent>
        </ReplayDetailsProviders>
      ) : null}
    </PreviewContainer>
  );
}

const TwoColumnContainer = styled('div')`
  display: flex;
  gap: ${space(4)};
  height: calc(100vh - 200px);
  padding: ${space(3)};
`;

const LeftColumn = styled('div')`
  flex: 1;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  padding: ${space(3)};
`;

const RightColumn = styled('div')`
  flex: 1;
  min-width: 400px;
  display: flex;
  flex-direction: column;
`;

const ReplayListScrollContainer = styled('div')`
  flex: 1 1 auto;
  min-height: 200px;
  max-height: 350px;
  overflow-y: auto;
  margin-bottom: ${space(2)};
`;

const PreviewContainer = styled('div')`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: ${space(3)};
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const PreviewTitle = styled('h3')`
  margin: 0 0 ${space(2)} 0;
  font-size: 16px;
  font-weight: 600;
  color: ${p => p.theme.textColor};
`;

const PreviewContent = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ButtonContainer = styled('div')`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

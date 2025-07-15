import React, {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

interface CreateFlowPageProps {
  onReplaySelected?: (replaySlug: string) => void;
}

export default function CreateFlowPage({onReplaySelected}: CreateFlowPageProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [selectedReplay, setSelectedReplay] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterQuery] = useState('');
  const navigate = useNavigate();

  // Create an EventView for fetching replays
  const eventView = useMemo(() => {
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
      query: filterQuery || '', // Use empty string to get all replays when filterQuery is empty
      orderby: '-started_at', // Most recent first
    });
  }, [filterQuery, selection.projects]);

  // Create a location object for the replay list
  const location = useMemo(() => {
    return {query: {}} as Location<ReplayListLocationQuery>;
  }, []);

  // Fetch replays using the actual hook
  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
    queryReferrer: 'replayList',
    perPage: 20, // Limit to 20 replays for the page
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
        addSuccessMessage(t('Replay selected successfully.'));
        onReplaySelected?.(selectedReplay);
        // Navigate to the next step, e.g. /codecov/flows/new?replay=<id>
        navigate(`/codecov/flows/new?replay=${encodeURIComponent(selectedReplay)}`);
        setSelectedReplay(null);
      } catch (error) {
        const message = t('Failed to access replay.');
        addErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedReplay, onReplaySelected, navigate]
  );

  const handleCancel = useCallback(() => {
    // Go back to previous page or flows list
    navigate('/codecov/flows/');
    setSelectedReplay(null);
  }, [navigate]);

  const isFormValid = !!selectedReplay;

  return (
    <PageContainer>
      <h2 style={{marginBottom: 0}}>{t('Select Replay')}</h2>
      <p style={{marginBottom: '16px', color: '#6b7280'}}>
        {t('Select a replay to use as the basis for your new flow.')}
      </p>
      <form onSubmit={handleSubmit}>
        <FiltersContainer>
          <ReplaysFilters />
        </FiltersContainer>

        {isFetching ? (
          <div style={{textAlign: 'center', padding: '40px'}}>
            {t('Loading replays...')}
          </div>
        ) : fetchError ? (
          <div style={{textAlign: 'center', padding: '40px', color: '#dc2626'}}>
            {t('Error loading replays')}
          </div>
        ) : replays?.length === 0 ? (
          <div style={{textAlign: 'center', padding: '40px', color: '#6b7280'}}>
            {t('No replays found')}
          </div>
        ) : (
          <div style={{maxHeight: '400px', overflowY: 'auto', marginBottom: 24}}>
            {replays?.map(replay => (
              <div
                key={replay.id}
                onClick={() => setSelectedReplay(replay.id)}
                style={{
                  padding: '12px',
                  border: `2px solid ${selectedReplay === replay.id ? '#6366f1' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedReplay === replay.id ? '#f3f4f6' : 'white',
                  transition: 'all 0.2s ease',
                }}
                data-test-id={`replay-row-${replay.id}`}
                tabIndex={0}
                role="button"
                aria-pressed={selectedReplay === replay.id}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedReplay(replay.id);
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
                    <div style={{fontWeight: 600, marginBottom: '4px'}}>
                      {replay.urls?.[0]
                        ? (() => {
                            try {
                              return new URL(replay.urls[0]).pathname;
                            } catch {
                              return replay.urls[0] || t('Unknown URL');
                            }
                          })()
                        : t('Unknown URL')}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '4px',
                      }}
                    >
                      {t('User')}:{' '}
                      {replay.user?.display_name || replay.user?.email || t('Unknown')}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '4px',
                      }}
                    >
                      {t('Duration')}:{' '}
                      {replay.duration ? Math.round(replay.duration.asSeconds()) : 0}s
                    </div>
                    <div style={{fontSize: '12px', color: '#6b7280'}}>
                      {replay.started_at?.toLocaleString() || t('Unknown time')}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      fontFamily: 'monospace',
                    }}
                  >
                    {replay.id.substring(0, 8)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
          <Button priority="default" onClick={handleCancel} type="button">
            {t('Cancel')}
          </Button>
          <Button
            priority="primary"
            disabled={isSubmitting || !isFormValid}
            type="submit"
          >
            {isSubmitting ? t('Loading...') : t('Select Replay')}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

const PageContainer = styled('div')`
  max-width: 600px;
  margin: 40px auto 0 auto;
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 2px 8px rgba(60, 60, 60, 0.06);
  padding: 32px 32px 24px 32px;
`;

const FiltersContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
  flex-wrap: wrap;
  margin-bottom: 20px;
`;

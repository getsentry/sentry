import React, {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

interface CreateFlowModalProps extends ModalRenderProps {
  onReplaySelected?: (replaySlug: string) => void;
}

export default function CreateFlowModal({
  onReplaySelected,
  closeModal,
  Header,
  Body,
  Footer,
}: CreateFlowModalProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [selectedReplay, setSelectedReplay] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterQuery] = useState('');

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
    perPage: 20, // Limit to 20 replays for the modal
  });

  const handleSubmit = useCallback(() => {
    if (!selectedReplay) {
      addErrorMessage(t('Please select a replay'));
      return;
    }

    setIsSubmitting(true);
    addLoadingMessage();

    try {
      addSuccessMessage(t('Replay selected successfully.'));
      onReplaySelected?.(selectedReplay);
      closeModal();

      // Reset form
      setSelectedReplay(null);
    } catch (error) {
      const message = t('Failed to access replay.');
      addErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedReplay, onReplaySelected, closeModal]);

  const handleCancel = useCallback(() => {
    closeModal();
    // Reset form
    setSelectedReplay(null);
  }, [closeModal]);

  const isFormValid = selectedReplay;

  return (
    <React.Fragment>
      <Header closeButton>{t('Select Replay')}</Header>
      <Body>
        <div style={{padding: '20px'}}>
          <div style={{marginBottom: '20px'}}>
            <p style={{marginBottom: '16px', color: '#6b7280'}}>
              {t('Select a replay to use as the basis for your new flow.')}
            </p>
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
              <div style={{maxHeight: '400px', overflowY: 'auto'}}>
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
                          {replay.user?.display_name ||
                            replay.user?.email ||
                            t('Unknown')}
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
          </div>
        </div>
      </Body>
      <Footer>
        <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
          <Button priority="default" onClick={handleCancel}>
            {t('Cancel')}
          </Button>
          <Button
            priority="primary"
            disabled={isSubmitting || !isFormValid}
            onClick={handleSubmit}
          >
            {isSubmitting ? t('Loading...') : t('Select Replay')}
          </Button>
        </div>
      </Footer>
    </React.Fragment>
  );
}

const FiltersContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
  flex-wrap: wrap;
`;

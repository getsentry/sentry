import {useParams} from 'react-router-dom';
import styled from '@emotion/styled';
import type {Breadcrumb} from '@sentry/core';
import {ErrorBoundary} from '@sentry/react';

import ReplayView from 'sentry/components/replays/replayView';
import {t} from 'sentry/locale';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';

import {sampleFlows} from './flowInstances/data/data';
import type {Flow} from './types';

const _breadcrumbToFlow = (breadcrumbs: Breadcrumb[]): Flow[] => {
  return breadcrumbs.map(breadcrumb => ({
    id: breadcrumb.message || breadcrumb.category || 'unknown',
    title: breadcrumb.message || breadcrumb.category || 'Unknown Flow',
    timestamp: breadcrumb.timestamp,
    type: breadcrumb.category || 'default',
    createdBy: 'system',
    failures: 0,
    lastChecked: breadcrumb.timestamp?.toString() || Date.now().toString(),
    lastSeen: breadcrumb.timestamp?.toString() || Date.now().toString(),
    status: 'Active',
    description: breadcrumb.message || 'No description available',
    linkedIssues: [],
    name: breadcrumb.message || breadcrumb.category || 'Unknown Flow',
  }));
};

const StatusBadge = styled('span')<{status: string}>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  background-color: ${props => (props.status === 'Active' ? '#ecfdf5' : '#fef2f2')};
  color: ${props => (props.status === 'Active' ? '#065f46' : '#991b1b')};
`;

const LayoutContainer = styled('div')`
  display: flex;
  gap: 24px;
  height: calc(100vh - 200px);
`;

const ReplaySection = styled('div')`
  flex: 1;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
`;

export default function New() {
  const {flowId} = useParams<{flowId: string}>();

  // For the new flow page, we'll use a default flow or create a new one
  const flow = flowId
    ? sampleFlows.find(f => f.id === flowId) || {
        id: 'new-flow',
        name: 'New Flow',
        createdBy: 'Current User',
        status: 'Active',
        lastSeen: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
        failures: 0,
        linkedIssues: [],
      }
    : {
        id: 'new-flow',
        name: 'New Flow',
        createdBy: 'Current User',
        status: 'Active',
        lastSeen: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
        failures: 0,
        linkedIssues: [],
      };

  const replaySlug = 'acd5d72f6ba54385ac80abe9dfadb142';
  const orgSlug = 'codecov';

  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });

  const {replay: _replay, replayRecord: _replayRecord} = readerResult;

  return (
    <div style={{padding: '20px'}}>
      {/* Header */}
      <div style={{marginBottom: '24px'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <h1 style={{margin: 0, fontSize: '28px', fontWeight: 600}}>{flow.name}</h1>
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <StatusBadge status={flow.status}>{flow.status}</StatusBadge>
            <button>{t('Edit Flow')}</button>
          </div>
        </div>
        <p style={{color: '#6b7280', margin: 0}}>
          {t('Created by')} {flow.createdBy}
        </p>
      </div>

      {/* Main Layout: Replay Video on Left, Breadcrumbs on Right */}
      <LayoutContainer>
        <ReplaySection>
          <ReplayVideo />
        </ReplaySection>

        <div>
          <h3 style={{margin: '0 0 16px 0', fontSize: '18px'}}>
            {t('Session Breadcrumbs')}
          </h3>
        </div>
      </LayoutContainer>
    </div>
  );
}

function ReplayVideo() {
  return (
    <ErrorBoundary>
      <ReplayView toggleFullscreen={() => {}} isLoading={false} />
    </ErrorBoundary>
  );
}

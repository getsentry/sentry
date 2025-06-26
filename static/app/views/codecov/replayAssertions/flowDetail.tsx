import {useParams} from 'react-router-dom';
import styled from '@emotion/styled';
import type {Breadcrumb} from '@sentry/core';

import {t} from 'sentry/locale';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';

import type {Flow} from './types';


const sampleFlows: Flow[] = [
  {
    id: 'flow1',
    name: 'User Login Flow',
    createdBy: 'John Doe',
    status: 'Active',
    lastSeen: '2024-01-15T10:30:00Z',
    lastChecked: '2024-01-15T09:15:00Z',
    failures: 2,
    linkedIssues: ['ISSUE-123', 'ISSUE-456'],
  },
  {
    id: 'flow2',
    name: 'Payment Processing',
    createdBy: 'Jane Smith',
    status: 'Inactive',
    lastSeen: '2024-01-14T16:45:00Z',
    lastChecked: '2024-01-14T15:30:00Z',
    failures: 0,
    linkedIssues: [],
  },
  {
    id: 'flow3',
    name: 'Product Search',
    createdBy: 'Mike Johnson',
    status: 'Active',
    lastSeen: '2024-01-15T14:20:00Z',
    lastChecked: '2024-01-15T13:45:00Z',
    failures: 1,
    linkedIssues: ['ISSUE-789'],
  },
  {
    id: 'flow4',
    name: 'User Registration',
    createdBy: 'Sarah Wilson',
    status: 'Active',
    lastSeen: '2024-01-15T11:10:00Z',
    lastChecked: '2024-01-15T10:55:00Z',
    failures: 0,
    linkedIssues: [],
  },
  {
    id: 'flow5',
    name: 'Shopping Cart Checkout',
    createdBy: 'David Brown',
    status: 'Inactive',
    lastSeen: '2024-01-13T09:30:00Z',
    lastChecked: '2024-01-13T08:15:00Z',
    failures: 3,
    linkedIssues: ['ISSUE-101', 'ISSUE-102', 'ISSUE-103'],
  },
];

const breadcrumbToFlow = (breadcrumbs: Breadcrumb[]): Flow[] => {
  return breadcrumbs.map(breadcrumb => ({
    id: breadcrumb.id,
    title: breadcrumb.title,
    timestamp: breadcrumb.timestamp,
    type: breadcrumb.type,
    createdBy: breadcrumb.createdBy,
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

const MetricCard = styled('div')`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
`;

const MetricValue = styled('div')`
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
`;

const MetricLabel = styled('div')`
  font-size: 14px;
  color: #6b7280;
`;

const IssueTag = styled('span')`
  display: inline-block;
  background: #f3f4f6;
  color: #374151;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-right: 8px;
  margin-bottom: 4px;
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

const BreadcrumbsSection = styled('div')`
  flex: 1;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
`;

const BreadcrumbItem = styled('div')`
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const BreadcrumbTitle = styled('div')`
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
`;

const BreadcrumbDetails = styled('div')`
  font-size: 12px;
  color: #6b7280;
`;

export default function FlowDetail() {
  const {flowId} = useParams<{flowId: string}>();

  // Find the flow by ID
  const flow = sampleFlows.find(f => f.id === flowId);

    const replaySlug = 'acd5d72f6ba54385ac80abe9dfadb142';
    const orgSlug = 'codecov';

    const readerResult = useLoadReplayReader({
      replaySlug,
      orgSlug,
    });

    const {replay, replayRecord} = readerResult;

    console.log({replay});
    console.log({replayRecord});

  if (!flow) {
    return (
      <div style={{padding: '20px', textAlign: 'center'}}>
        <h2>{t('Flow not found')}</h2>
        <p>{t('The requested flow could not be found.')}</p>
      </div>
    );
  }

  // Sample breadcrumbs data
  const breadcrumbs = [
    {id: 1, title: 'Page Load', timestamp: '10:30:15', type: 'navigation'},
    {id: 2, title: 'User Login Form', timestamp: '10:30:20', type: 'ui'},
    {id: 3, title: 'Email Input', timestamp: '10:30:25', type: 'ui'},
    {id: 4, title: 'Password Input', timestamp: '10:30:30', type: 'ui'},
    {id: 5, title: 'Login Button Click', timestamp: '10:30:35', type: 'ui'},
    {id: 6, title: 'API Call: /auth/login', timestamp: '10:30:40', type: 'http'},
    {id: 7, title: 'Redirect to Dashboard', timestamp: '10:30:45', type: 'navigation'},
  ];

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
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '48px', marginBottom: '16px'}}>🎥</div>
            <div>{t('Replay Video Player')}</div>
            <div style={{fontSize: '14px', marginTop: '8px'}}>
              {t('Video playback will appear here')}
            </div>
          </div>
        </ReplaySection>

        <BreadcrumbsSection>
          <h3 style={{margin: '0 0 16px 0', fontSize: '18px'}}>
            {t('Session Breadcrumbs')}
          </h3>
          <Breadcrumbs
            items={breadcrumbToFlow(breadcrumbs)}
            startTimestampMs={Date.now()}
            onClickTimestamp={() => {}}
            expandPaths={new Map()}
            onToggleDetails={() => {}}
          />
        </BreadcrumbsSection>
      </LayoutContainer>
    </div>
  );
}

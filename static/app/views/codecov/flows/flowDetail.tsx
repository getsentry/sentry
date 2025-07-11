import {useParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayView from 'sentry/components/replays/replayView';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useNavigate} from 'sentry/utils/useNavigate';
import ReplayDetailsProviders from 'sentry/views/replays/detail/body/replayDetailsProviders';
import ReplayDetailsPageBreadcrumbs from 'sentry/views/replays/detail/header/replayDetailsPageBreadcrumbs';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

import {useLocalStorageFlows} from './hooks/useLocalStorageFlows';

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

const Header = styled(Layout.Header)`
  gap: ${space(1)};
  padding-bottom: ${space(1.5)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    gap: ${space(1)} ${space(3)};
    padding: ${space(2)} ${space(2)} ${space(1.5)} ${space(2)};
  }
`;

const FlowInfoCard = styled('div')`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

const FlowInfoRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
`;

const FlowInfoLabel = styled('span')`
  font-weight: 500;
  color: #374151;
`;

const FlowInfoValue = styled('span')`
  color: #6b7280;
`;

const BreadcrumbInfo = styled('div')`
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
`;

const BreadcrumbItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(0.5)} ${space(0.75)};
  margin: 4px 0;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: ${p => p.theme.translucentSurface200};
  }
`;

const BreadcrumbIcon = styled('div')<{color: string}>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${props => props.color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  font-weight: bold;
`;

const BreadcrumbContent = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const BreadcrumbTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 500;
  color: ${p => p.theme.textColor};
`;

const BreadcrumbDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
`;

const BreadcrumbTimestamp = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.sm};
  align-self: flex-start;
`;

export default function FlowDetail() {
  const {flowId} = useParams<{flowId: string}>();
  const {getFlow, isLoading} = useLocalStorageFlows();

  // Find the flow by ID
  const flow = flowId ? getFlow(flowId) : undefined;

  // Get replay data for display
  const replaySlug = flow?.metadata?.replaySlug || '135fc779c3894f5682bf0e3a76060469';
  const orgSlug = flow?.metadata?.orgSlug || 'codecov';

  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });

  const {replay} = readerResult;
  const {onClickTimestamp} = useCrumbHandlers();

  // Create mock breadcrumb frames for start and end points
  const createMockBreadcrumbFrame = (breadcrumbId: string, isStart: boolean) => {
    if (!replay || !breadcrumbId) return null;

    // Parse the breadcrumb ID to get offsetMs
    // Format is "offsetMs-index"
    const parts = breadcrumbId.split('-');
    const offsetMs = parts.length > 0 ? parseInt(parts[0], 10) : 0;

    console.log('Creating breadcrumb frame:', {
      breadcrumbId,
      offsetMs,
      startTimestampMs: replay.getStartTimestampMs(),
      timestampMs: replay.getStartTimestampMs() + offsetMs,
      isStart,
    });

    return {
      offsetMs,
      timestampMs: replay.getStartTimestampMs() + offsetMs,
      category: isStart ? 'ui.click' : 'ui.click',
      message: isStart ? 'Flow Start Point' : 'Flow End Point',
      data: {},
    };
  };

  const startFrame = flow?.metadata?.startBreadcrumb
    ? createMockBreadcrumbFrame(flow.metadata.startBreadcrumb, true)
    : null;

  const endFrame = flow?.metadata?.endBreadcrumb
    ? createMockBreadcrumbFrame(flow.metadata.endBreadcrumb, false)
    : null;

  if (isLoading) {
    return (
      <div style={{padding: '20px', textAlign: 'center'}}>
        <h2>{t('Loading...')}</h2>
      </div>
    );
  }

  if (!flow) {
    return (
      <div style={{padding: '20px', textAlign: 'center'}}>
        <h2>{t('Flow not found')}</h2>
        <p>{t('The requested flow could not be found.')}</p>
      </div>
    );
  }

  if (!replay) {
    return (
      <div style={{padding: '20px', textAlign: 'center'}}>
        <h2>{t('Loading replay...')}</h2>
      </div>
    );
  }

  return (
    <ReplayDetailsProviders replay={replay} projectSlug="gazebo">
      <div style={{padding: '20px'}}>
        {/* Header */}
        <div style={{marginBottom: '24px'}}>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Flows'),
                to: '/codecov/flows/',
              },
              {
                label: flow.name,
              },
            ]}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h1 style={{margin: 0, fontSize: '28px', fontWeight: 600}}>{flow.name}</h1>
          </div>
          <p style={{color: '#6b7280', margin: 0}}>
            {t('Created by')} {flow.createdBy}
          </p>
        </div>

        {/* Main Layout: Replay Video on Left, Flow Info on Right */}
        <LayoutContainer>
          <div style={{display: 'flex', flexDirection: 'row', gap: '20px', flex: 1}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '20px', flex: 2}}>
              <Header>
                <ReplayDetailsPageBreadcrumbs readerResult={readerResult} />
              </Header>
              <ReplayView toggleFullscreen={() => {}} isLoading={false} />
              <ReplayController
                isLoading={false}
                toggleFullscreen={() => {}}
                hideFastForward={false}
              />
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '20px', flex: 1}}>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '10px',
                }}
              >
                Flow Details
              </div>

              <FlowInfoCard>
                <FlowInfoRow>
                  <FlowInfoLabel>{t('Status')}</FlowInfoLabel>
                  <FlowInfoValue>
                    <StatusBadge status={flow.status}>{flow.status}</StatusBadge>
                  </FlowInfoValue>
                </FlowInfoRow>

                <FlowInfoRow>
                  <FlowInfoLabel>{t('Created')}</FlowInfoLabel>
                  <FlowInfoValue>
                    {new Date(flow.lastChecked).toLocaleDateString()}
                  </FlowInfoValue>
                </FlowInfoRow>

                <FlowInfoRow>
                  <FlowInfoLabel>{t('Last Seen')}</FlowInfoLabel>
                  <FlowInfoValue>
                    {new Date(flow.lastSeen).toLocaleDateString()}
                  </FlowInfoValue>
                </FlowInfoRow>

                <FlowInfoRow>
                  <FlowInfoLabel>{t('Failures')}</FlowInfoLabel>
                  <FlowInfoValue>{flow.failures}</FlowInfoValue>
                </FlowInfoRow>

                {flow.linkedIssues.length > 0 && (
                  <FlowInfoRow>
                    <FlowInfoLabel>{t('Linked Issues')}</FlowInfoLabel>
                    <FlowInfoValue>{flow.linkedIssues.join(', ')}</FlowInfoValue>
                  </FlowInfoRow>
                )}
              </FlowInfoCard>

              {flow.metadata && (
                <FlowInfoCard>
                  <div style={{fontWeight: 'bold', marginBottom: '12px'}}>
                    {t('Flow Configuration')}
                  </div>

                  {startFrame ? (
                    <BreadcrumbItem
                      onClick={() => {
                        console.log('Clicking start frame:', startFrame);
                        onClickTimestamp(startFrame);
                      }}
                    >
                      <BreadcrumbIcon color="#10b981">S</BreadcrumbIcon>
                      <BreadcrumbContent>
                        <BreadcrumbTitle>{t('Start Point')}</BreadcrumbTitle>
                        <BreadcrumbDescription>
                          {flow.metadata.startBreadcrumb || t('Unknown')}
                        </BreadcrumbDescription>
                      </BreadcrumbContent>
                      <BreadcrumbTimestamp>
                        <TimestampButton
                          startTimestampMs={replay.getStartTimestampMs()}
                          timestampMs={startFrame.timestampMs}
                        />
                      </BreadcrumbTimestamp>
                    </BreadcrumbItem>
                  ) : (
                    <BreadcrumbInfo>
                      <div style={{fontWeight: 500, marginBottom: '8px'}}>
                        {t('Start Point')}
                      </div>
                      <div style={{color: '#6b7280', fontSize: '14px'}}>
                        {t('Not set')}
                      </div>
                    </BreadcrumbInfo>
                  )}

                  {endFrame ? (
                    <BreadcrumbItem
                      onClick={() => {
                        console.log('Clicking end frame:', endFrame);
                        onClickTimestamp(endFrame);
                      }}
                    >
                      <BreadcrumbIcon color="#ef4444">E</BreadcrumbIcon>
                      <BreadcrumbContent>
                        <BreadcrumbTitle>{t('End Point')}</BreadcrumbTitle>
                        <BreadcrumbDescription>
                          {flow.metadata.endBreadcrumb || t('Unknown')}
                        </BreadcrumbDescription>
                      </BreadcrumbContent>
                      <BreadcrumbTimestamp>
                        <TimestampButton
                          startTimestampMs={replay.getStartTimestampMs()}
                          timestampMs={endFrame.timestampMs}
                        />
                      </BreadcrumbTimestamp>
                    </BreadcrumbItem>
                  ) : (
                    <BreadcrumbInfo>
                      <div style={{fontWeight: 500, marginBottom: '8px'}}>
                        {t('End Point')}
                      </div>
                      <div style={{color: '#6b7280', fontSize: '14px'}}>
                        {t('Not set')}
                      </div>
                    </BreadcrumbInfo>
                  )}

                  {flow.metadata.replaySlug && (
                    <BreadcrumbInfo>
                      <div style={{fontWeight: 500, marginBottom: '8px'}}>
                        {t('Replay Session')}
                      </div>
                      <div style={{color: '#6b7280', fontSize: '14px'}}>
                        {flow.metadata.replaySlug}
                      </div>
                    </BreadcrumbInfo>
                  )}
                </FlowInfoCard>
              )}
            </div>
          </div>
        </LayoutContainer>
      </div>
    </ReplayDetailsProviders>
  );
}

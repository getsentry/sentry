import React, {useState} from 'react';
import {useParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import TextField from 'sentry/components/forms/fields/textField';
import * as Layout from 'sentry/components/layouts/thirds';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayView from 'sentry/components/replays/replayView';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import ReplayDetailsProviders from 'sentry/views/replays/detail/body/replayDetailsProviders';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
import ReplayDetailsPageBreadcrumbs from 'sentry/views/replays/detail/header/replayDetailsPageBreadcrumbs';

import {sampleFlows} from './flowInstances/data/data';
import {FlowCreateForm} from './create';

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

const FlowButton = styled(Button)`
  padding: 4px 8px;
  font-size: 12px;
  height: 24px;
  min-height: 24px;
`;

const SelectionStatus = styled('div')`
  font-size: 12px;
  color: #6b7280;
  margin-top: 8px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 4px;
`;

const BreadcrumbsWrapper = styled('div')`
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  height: 500px;
  overflow: hidden;
`;

const BreadcrumbsContainer = styled('div')`
  flex: 1;
  overflow: hidden;
`;

const FlowButtonColumn = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-left: 1px solid #e5e7eb;
  background: #f9fafb;
  min-width: 80px;
  margin-top: 32px;
`;

const FlowButtonContainer = styled('div')<{isEnd: boolean; isStart: boolean}>`
  height: 53px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding-top: 16px;
  position: relative;

  ${props =>
    props.isStart &&
    `
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: #8b5cf6;
      border-radius: 2px;
    }
  `}

  ${props =>
    props.isEnd &&
    `
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: #8b5cf6;
      border-radius: 2px;
    }
  `}
`;

// Component that wraps the existing Breadcrumbs and adds flow buttons
function BreadcrumbsWithFlowButtons({
  startBreadcrumbId,
  endBreadcrumbId,
  onSetStart,
  onSetEnd,
  flowForm,
  filteredFrames,
  hasFilters,
}: {
  endBreadcrumbId: string | null;
  filteredFrames: any[];
  hasFilters: boolean;
  onSetEnd: (breadcrumbId: string) => void;
  onSetStart: (breadcrumbId: string) => void;
  startBreadcrumbId: string | null;
  flowForm?: React.ReactNode;
}) {
  const frames = filteredFrames;

  return (
    <div>
      <SelectionStatus>
        {startBreadcrumbId !== null && endBreadcrumbId !== null ? (
          <div>
            ✅ Flow range selected: {startBreadcrumbId} to {endBreadcrumbId}
          </div>
        ) : startBreadcrumbId === null ? (
          <div>
            📋 Select a start point for your flow.
            {hasFilters && (
              <div style={{fontSize: '11px', color: '#9ca3af', marginTop: '4px'}}>
                💡 Tip: Clear filters to see all breadcrumbs
              </div>
            )}
          </div>
        ) : (
          <div>📋 Start set at {startBreadcrumbId}. Select an end point.</div>
        )}
      </SelectionStatus>
      <BreadcrumbsWrapper>
        <BreadcrumbsContainer>
          <Breadcrumbs />
        </BreadcrumbsContainer>
        <FlowButtonColumn>
          {frames.map((frame, index) => {
            // Create a unique ID based on frame data to handle filtering correctly
            const frameId = `${frame.offsetMs}-${index}`;
            return (
              <FlowButtonContainer
                key={frameId}
                isStart={startBreadcrumbId === frameId}
                isEnd={endBreadcrumbId === frameId}
              >
                <FlowButton
                  size="xs"
                  priority={startBreadcrumbId === frameId ? 'primary' : 'default'}
                  onClick={() => onSetStart(frameId)}
                  disabled={
                    endBreadcrumbId !== null &&
                    index >
                      frames.findIndex((_, i) => `${_.offsetMs}-${i}` === endBreadcrumbId)
                  }
                >
                  {startBreadcrumbId === frameId ? '✓' : 'S'}
                </FlowButton>
                <FlowButton
                  size="xs"
                  priority={endBreadcrumbId === frameId ? 'primary' : 'default'}
                  onClick={() => onSetEnd(frameId)}
                  disabled={
                    startBreadcrumbId === null ||
                    index <
                      frames.findIndex(
                        (_, i) => `${_.offsetMs}-${i}` === startBreadcrumbId
                      )
                  }
                >
                  {endBreadcrumbId === frameId ? '✓' : 'E'}
                </FlowButton>
              </FlowButtonContainer>
            );
          })}
        </FlowButtonColumn>
      </BreadcrumbsWrapper>
      {flowForm && <div style={{marginTop: '16px'}}>{flowForm}</div>}
    </div>
  );
}

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

  const replaySlug = '135fc779c3894f5682bf0e3a76060469';
  const orgSlug = 'codecov';

  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });

  const {replay, replayRecord: _replayRecord} = readerResult;

  // State for flow creation
  const [startBreadcrumbId, setStartBreadcrumbId] = useState<string | null>(null);
  const [endBreadcrumbId, setEndBreadcrumbId] = useState<string | null>(null);

  // Get filtered frames at component level
  const allFrames = replay?.getChapterFrames() || [];
  const filterProps = useBreadcrumbFilters({frames: allFrames});
  const {items: filteredFrames, searchTerm, type} = filterProps;

  // Clear selections if they're no longer visible due to filtering
  const clearSelectionsIfNeeded = React.useCallback(() => {
    if (
      startBreadcrumbId &&
      !filteredFrames.some(
        f => `${f.offsetMs}-${filteredFrames.indexOf(f)}` === startBreadcrumbId
      )
    ) {
      setStartBreadcrumbId(null);
    }
    if (
      endBreadcrumbId &&
      !filteredFrames.some(
        f => `${f.offsetMs}-${filteredFrames.indexOf(f)}` === endBreadcrumbId
      )
    ) {
      setEndBreadcrumbId(null);
    }
  }, [startBreadcrumbId, endBreadcrumbId, filteredFrames]);

  // Clear selections when filters change
  React.useEffect(() => {
    clearSelectionsIfNeeded();
  }, [searchTerm, type, clearSelectionsIfNeeded]);

  const handleSetStart = (breadcrumbId: string) => {
    // Toggle selection - if already selected, deselect it
    if (startBreadcrumbId === breadcrumbId) {
      setStartBreadcrumbId(null);
      return;
    }

    setStartBreadcrumbId(breadcrumbId);
    if (endBreadcrumbId !== null) {
      const startIndex = filteredFrames.findIndex(
        (f: any) => `${f.offsetMs}-${filteredFrames.indexOf(f)}` === breadcrumbId
      );
      const endIndex = filteredFrames.findIndex(
        (f: any) => `${f.offsetMs}-${filteredFrames.indexOf(f)}` === endBreadcrumbId
      );
      if (startIndex > endIndex) {
        setEndBreadcrumbId(null);
      }
    }
  };

  const handleSetEnd = (breadcrumbId: string) => {
    // Toggle selection - if already selected, deselect it
    if (endBreadcrumbId === breadcrumbId) {
      setEndBreadcrumbId(null);
      return;
    }

    // Only allow setting end if start is selected
    if (startBreadcrumbId === null) return;

    const startIndex = filteredFrames.findIndex(
      (f: any) => `${f.offsetMs}-${filteredFrames.indexOf(f)}` === startBreadcrumbId
    );
    const endIndex = filteredFrames.findIndex(
      (f: any) => `${f.offsetMs}-${filteredFrames.indexOf(f)}` === breadcrumbId
    );
    if (endIndex >= startIndex) {
      setEndBreadcrumbId(breadcrumbId);
    }
  };

  const handleFormSubmit = (formData: any) => {
    // Combine form data with breadcrumb selection
    const _flowData = {
      ...formData,
      startBreadcrumbId,
      endBreadcrumbId,
      replaySlug,
      orgSlug,
    };

    // Here you would typically make an API call to create the flow
  };

  if (!replay) {
    return <div>Loading...</div>;
  }

  return (
    <ReplayDetailsProviders replay={replay} projectSlug="gazebo">
      <div style={{padding: '20px'}}>
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
          </div>
          <p style={{color: '#6b7280', margin: 0}}>
            {t('Created by')} {flow.createdBy}
          </p>
        </div>

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
                Create New Flow
              </div>
              <TextField
                name="name"
                label={t('Flow Name')}
                required
                help={t('A name to help you identify this flow.')}
              />
              <BreadcrumbsWithFlowButtons
                startBreadcrumbId={startBreadcrumbId}
                endBreadcrumbId={endBreadcrumbId}
                onSetStart={handleSetStart}
                onSetEnd={handleSetEnd}
                filteredFrames={filteredFrames}
                hasFilters={searchTerm !== '' || type.length > 0}
                flowForm={
                  <FlowCreateForm
                    organization={{slug: orgSlug} as any}
                    onCreatedFlow={createdFlow => {
                      handleFormSubmit({name: createdFlow.name});
                    }}
                    startBreadcrumb={startBreadcrumbId}
                    endBreadcrumb={endBreadcrumbId}
                    replaySlug={replaySlug}
                    orgSlug={orgSlug}
                  />
                }
              />
            </div>
          </div>
        </LayoutContainer>
      </div>
    </ReplayDetailsProviders>
  );
}

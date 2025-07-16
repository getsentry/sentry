import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import TextField from 'sentry/components/forms/fields/textField';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ReplayDetailsProviders from 'sentry/views/replays/detail/body/replayDetailsProviders';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';

// Step-based breadcrumbs component similar to BuilderBreadCrumbs
function FlowBuilderBreadCrumbs({title, flowName}: {title: string; flowName?: string}) {
  const crumbs = [
    {
      to: `/codecov/flows/`,
      label: t('Flows'),
      preservePageFilters: true,
    },
    {
      label: title,
      ...(flowName
        ? {
            to: `/codecov/flows/new/`,
            preservePageFilters: true,
          }
        : {}),
    },
  ];
  if (flowName) {
    crumbs.push({label: flowName});
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space(1),
        marginBottom: space(3),
      }}
    >
      {crumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          {crumb.to ? (
            <Link to={crumb.to} style={{color: '#6b7280', textDecoration: 'none'}}>
              {crumb.label}
            </Link>
          ) : (
            <span style={{color: '#374151', fontWeight: 500}}>{crumb.label}</span>
          )}
          {index < crumbs.length - 1 && (
            <span style={{color: '#9ca3af', margin: '0 8px'}}>/</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

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

const StepContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const StepContent = styled('div')`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: ${space(3)};
`;

const StepTitle = styled('h3')`
  margin: 0 0 ${space(2)} 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
`;

const StepDescription = styled('p')`
  margin: 0 0 ${space(3)} 0;
  color: #6b7280;
  font-size: 14px;
`;

const StepNavigation = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(2)} 0;
  border-top: 1px solid #e5e7eb;
  margin-top: ${space(3)};
`;

const StepIndicator = styled('div')`
  font-size: 12px;
  color: #6b7280;
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
                  {startBreadcrumbId === frameId ? '✓' : 'Start'}
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
                  {endBreadcrumbId === frameId ? '✓' : 'End'}
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

type Step = 'select-replay' | 'define-flow' | 'configure-flow';

export default function New() {
  const location = useLocation();
  const organization = useOrganization();
  const [replaySlug, setReplaySlug] = useState<string | undefined>();
  const [currentStep, setCurrentStep] = useState<Step>('select-replay');
  const [flowName, setFlowName] = useState('');
  const [startBreadcrumbId, setStartBreadcrumbId] = useState<string | null>(null);
  const [endBreadcrumbId, setEndBreadcrumbId] = useState<string | null>(null);

  // Load replay data when replaySlug is available
  const readerResult = useLoadReplayReader({
    replaySlug: replaySlug || '',
    orgSlug: organization.slug,
  });
  const {replay: replayReader, replayRecord} = readerResult || {};

  // Get filtered frames for breadcrumb selection
  const allFrames = replayReader?.getChapterFrames() || [];
  const filterProps = useBreadcrumbFilters({frames: allFrames});
  const {items: filteredFrames, searchTerm, type} = filterProps;

  // Extract replay slug from URL query parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const replay = searchParams.get('replay');
    if (replay) {
      setReplaySlug(replay);
      setCurrentStep('define-flow');
    }
  }, [location.search]);

  const handleSetStart = (breadcrumbId: string) => {
    setStartBreadcrumbId(breadcrumbId);
  };

  const handleSetEnd = (breadcrumbId: string) => {
    setEndBreadcrumbId(breadcrumbId);
  };

  const handleNextStep = () => {
    if (currentStep === 'select-replay') {
      setCurrentStep('define-flow');
    } else if (currentStep === 'define-flow') {
      if (startBreadcrumbId && endBreadcrumbId) {
        setCurrentStep('configure-flow');
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 'define-flow') {
      setCurrentStep('select-replay');
    } else if (currentStep === 'configure-flow') {
      setCurrentStep('define-flow');
    }
  };

  const canProceedToNextStep = () => {
    if (currentStep === 'select-replay') {
      return !!replaySlug;
    }
    if (currentStep === 'define-flow') {
      return startBreadcrumbId && endBreadcrumbId;
    }
    return true;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'select-replay':
        return (
          <StepContent>
            <StepTitle>{t('Step 1: Select a Replay')}</StepTitle>
            <StepDescription>
              {t(
                'Choose a replay session to create a flow from. This will help you define the user journey you want to monitor.'
              )}
            </StepDescription>
            <div>
              <TextField
                name="replay"
                label={t('Replay URL or ID')}
                placeholder={t('Enter replay URL or ID')}
                value={replaySlug || ''}
                onChange={e => setReplaySlug(e.target.value)}
              />
            </div>
          </StepContent>
        );
      case 'define-flow':
        return (
          <StepContent>
            <StepTitle>{t('Step 2: Define Flow Range')}</StepTitle>
            <StepDescription>
              {t(
                'Select the start and end points of your flow by clicking on the breadcrumbs below.'
              )}
            </StepDescription>
            {replayReader && replayRecord && (
              <ReplayDetailsProviders
                replay={replayReader}
                projectSlug={replayRecord.project_id}
              >
                <BreadcrumbsWithFlowButtons
                  startBreadcrumbId={startBreadcrumbId}
                  endBreadcrumbId={endBreadcrumbId}
                  onSetStart={handleSetStart}
                  onSetEnd={handleSetEnd}
                  filteredFrames={filteredFrames}
                  hasFilters={searchTerm !== '' || type.length > 0}
                />
              </ReplayDetailsProviders>
            )}
          </StepContent>
        );
      case 'configure-flow':
        return (
          <StepContent>
            <StepTitle>{t('Step 3: Configure Flow')}</StepTitle>
            <StepDescription>
              {t('Give your flow a name and configure any additional settings.')}
            </StepDescription>
            <div>
              <TextField
                name="name"
                label={t('Flow Name')}
                placeholder={t('Enter flow name')}
                value={flowName}
                onChange={e => setFlowName(e.target.value)}
                required
              />
            </div>
          </StepContent>
        );
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'select-replay':
        return t('Select Replay');
      case 'define-flow':
        return t('Define Flow');
      case 'configure-flow':
        return t('Configure Flow');
      default:
        return t('Create Flow');
    }
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'select-replay':
        return 1;
      case 'define-flow':
        return 2;
      case 'configure-flow':
        return 3;
      default:
        return 1;
    }
  };

  return (
    <Layout.Page>
      <SentryDocumentTitle title={t('Create New Flow')} />

      <Layout.Header>
        <Layout.HeaderContent>
          <FlowBuilderBreadCrumbs
            title={getStepTitle()}
            flowName={currentStep === 'configure-flow' ? flowName : undefined}
          />
          <Layout.Title>{t('Create New Flow')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <StepContainer>
            {renderStepContent()}

            <StepNavigation>
              <div>
                {currentStep !== 'select-replay' && (
                  <Button priority="default" onClick={handlePreviousStep}>
                    {t('Back')}
                  </Button>
                )}
              </div>

              <StepIndicator>
                {t('Step {{step}} of 3', {step: getStepNumber()})}
              </StepIndicator>

              <div>
                {currentStep === 'configure-flow' ? (
                  <Button
                    priority="primary"
                    disabled={!flowName.trim()}
                    onClick={() => {
                      // Handle final submission
                      // TODO: Implement flow creation
                    }}
                  >
                    {t('Create Flow')}
                  </Button>
                ) : (
                  <Button
                    priority="primary"
                    disabled={!canProceedToNextStep()}
                    onClick={handleNextStep}
                  >
                    {t('Next')}
                  </Button>
                )}
              </div>
            </StepNavigation>
          </StepContainer>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

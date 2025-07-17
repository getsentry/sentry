import React, {Fragment, useCallback, useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Breadcrumbs as PageBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import TextField from 'sentry/components/forms/fields/textField';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayView from 'sentry/components/replays/replayView';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useCreateFlowTemp} from 'sentry/views/codecov/flows/hooks';
import type {FlowDefinition} from 'sentry/views/codecov/flows/types';
import {getFrameId, getFrameIndexById} from 'sentry/views/codecov/flows/utils/frames';
import ReplayDetailsProviders from 'sentry/views/replays/detail/body/replayDetailsProviders';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
import ReplayDetailsPageBreadcrumbs from 'sentry/views/replays/detail/header/replayDetailsPageBreadcrumbs';

export default function SelectStartEndPage() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUser();
  const [replaySlug, setReplaySlug] = useState<string | undefined>();
  const [startBreadcrumbId, setStartBreadcrumbId] = useState<string | null>(null);
  const [endBreadcrumbId, setEndBreadcrumbId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {selection} = usePageFilters();
  const {mutateAsync: createFlow} = useCreateFlowTemp({
    pageFilters: selection,
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const replay = searchParams.get('replay');
    if (replay) setReplaySlug(replay);
  }, [location.search]);

  const isFormValid = () => {
    return name.trim() && startBreadcrumbId && endBreadcrumbId;
  };

  const getTooltipMessage = () => {
    if (!name.trim()) {
      return t('Please enter a flow name');
    }
    if (!startBreadcrumbId) {
      return t('Please select a start point');
    }
    if (!endBreadcrumbId) {
      return t('Please select an end point');
    }
    return '';
  };

  const handleSubmit = useCallback(async () => {
    if (!isFormValid()) return;

    setIsSubmitting(true);
    addLoadingMessage();

    try {
      const response = await createFlow({
        name: name.trim(),
        createdBy: user,
        status: 'active',
        description: `Flow created from replay: ${replaySlug}`,
        replayId: replaySlug || '',
        startBreadcrumb: startBreadcrumbId || '',
        endBreadcrumb: endBreadcrumbId || '',
      });

      addSuccessMessage(t('Created flow successfully.'));
      navigate('/codecov/flows/');
    } catch (error) {
      const message = t('Failed to create a new flow.');
      addErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    createFlow,
    endBreadcrumbId,
    isFormValid,
    name,
    navigate,
    replaySlug,
    setIsSubmitting,
    startBreadcrumbId,
    user,
  ]);

  if (!replaySlug) {
    return <EmptyStateWarning>{t('No replay found')}</EmptyStateWarning>;
  }

  return (
    <SentryDocumentTitle title={t('Select Replay')}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <PageBreadcrumbs
                crumbs={[
                  {
                    label: t('Flows'),
                    to: '/codecov/flows/',
                  },
                  {
                    label: t('Select Replay'),
                    to: '/codecov/flows/select-replay',
                  },
                  {
                    label: t('New Flow'),
                  },
                ]}
              />
              <Layout.Title>{t('New Flow')}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>

          <Layout.Body>
            <Layout.Main fullWidth>
              <List symbol="colored-numeric">
                <ListItem>{t('Give your flow a name')}</ListItem>
                <div style={{maxWidth: 400, marginBottom: 24}}>
                  <TextField
                    name="name"
                    label={t('Flow Name')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('Give your flow a name')}
                    required
                    flexibleControlStateSize
                  />
                </div>

                <ListItem>{t('Select a start and end point for your flow')}</ListItem>
                <SelectStartEndCard
                  replaySlug={replaySlug}
                  orgSlug={organization.slug}
                  organization={organization}
                  startBreadcrumbId={startBreadcrumbId}
                  setStartBreadcrumbId={setStartBreadcrumbId}
                  endBreadcrumbId={endBreadcrumbId}
                  setEndBreadcrumbId={setEndBreadcrumbId}
                />
                <div style={{display: 'flex', gap: '8px', marginTop: 24}}>
                  <Tooltip title={getTooltipMessage()} disabled={!!isFormValid()}>
                    <Button
                      priority="primary"
                      disabled={isSubmitting || !isFormValid()}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? t('Creating...') : t('Create Flow')}
                    </Button>
                  </Tooltip>
                  <Button priority="default" onClick={() => navigate(`/codecov/flows/`)}>
                    {t('Cancel')}
                  </Button>
                </div>
              </List>
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function SelectStartEndCard({
  replaySlug,
  orgSlug,
  organization,
  startBreadcrumbId,
  setStartBreadcrumbId,
  endBreadcrumbId,
  setEndBreadcrumbId,
}: {
  endBreadcrumbId: string | null;
  orgSlug: string;
  organization: ReturnType<typeof useOrganization>;
  replaySlug: string;
  setEndBreadcrumbId: React.Dispatch<React.SetStateAction<string | null>>;
  setStartBreadcrumbId: React.Dispatch<React.SetStateAction<string | null>>;
  startBreadcrumbId: string | null;
}) {
  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });

  const {replay, replayRecord} = readerResult || {};
  const isLoading = !readerResult?.replay;
  const error = readerResult && !readerResult.replay;

  // Get filtered frames at component level
  const allFrames = replay?.getChapterFrames() || [];
  const filterProps = useBreadcrumbFilters({frames: allFrames});
  const {items: filteredFrames, searchTerm, type} = filterProps;

  // Clear selections if they're no longer visible due to filtering
  const clearSelectionsIfNeeded = useCallback(() => {
    if (
      startBreadcrumbId &&
      getFrameIndexById(filteredFrames, startBreadcrumbId) === -1
    ) {
      setStartBreadcrumbId(null);
    }
    if (endBreadcrumbId && getFrameIndexById(filteredFrames, endBreadcrumbId) === -1) {
      setEndBreadcrumbId(null);
    }
  }, [
    startBreadcrumbId,
    endBreadcrumbId,
    filteredFrames,
    setStartBreadcrumbId,
    setEndBreadcrumbId,
  ]);

  // Clear selections when filters change
  useEffect(() => {
    clearSelectionsIfNeeded();
  }, [searchTerm, type, clearSelectionsIfNeeded]);

  const handleSetStart = (breadcrumbId: string) => {
    if (startBreadcrumbId === breadcrumbId) {
      setStartBreadcrumbId(null);
      return;
    }
    setStartBreadcrumbId(breadcrumbId);

    if (endBreadcrumbId !== null) {
      const startIndex = getFrameIndexById(filteredFrames, breadcrumbId);
      const endIndex = getFrameIndexById(filteredFrames, endBreadcrumbId);
      if (startIndex > endIndex) {
        setEndBreadcrumbId(null);
      }
    }
  };

  const handleSetEnd = (breadcrumbId: string) => {
    if (endBreadcrumbId === breadcrumbId) {
      setEndBreadcrumbId(null);
      return;
    }
    if (startBreadcrumbId === null) return;

    const startIndex = getFrameIndexById(filteredFrames, startBreadcrumbId);
    const endIndex = getFrameIndexById(filteredFrames, breadcrumbId);
    if (endIndex >= startIndex) {
      setEndBreadcrumbId(breadcrumbId);
    }
  };

  // If loading, show loading state
  if (isLoading) {
    return (
      <div style={{padding: '20px'}}>
        <EmptyStateWarning>{t('Loading replay...')}</EmptyStateWarning>
      </div>
    );
  }

  // If error or replay is null, show error state
  if (error || !replay) {
    return (
      <div style={{padding: '20px'}}>
        <EmptyStateWarning>{t('Could not load replay.')}</EmptyStateWarning>
      </div>
    );
  }

  return (
    <div>
      <ReplayDetailsProviders
        replay={replay}
        projectSlug={replayRecord?.project_id || ''}
      >
        <div style={{padding: '20px'}}>
          <LayoutContainer>
            <div style={{display: 'flex', flexDirection: 'row', gap: '20px', flex: 1}}>
              <div
                style={{display: 'flex', flexDirection: 'column', gap: '20px', flex: 1}}
              >
                <Header>
                  <ReplayDetailsPageBreadcrumbs readerResult={readerResult} />
                </Header>

                <ReplayView isLoading={false} toggleFullscreen={() => {}} />
                <ReplayController
                  isLoading={false}
                  hideFastForward={false}
                  toggleFullscreen={() => {}}
                />
              </div>

              <div
                style={{display: 'flex', flexDirection: 'column', gap: '20px', flex: 1}}
              >
                <SelectFromBreadcrumbsCard
                  startBreadcrumbId={startBreadcrumbId}
                  endBreadcrumbId={endBreadcrumbId}
                  onSetStart={handleSetStart}
                  onSetEnd={handleSetEnd}
                  filteredFrames={filteredFrames}
                  hasFilters={searchTerm !== '' || type.length > 0}
                />
              </div>
            </div>
          </LayoutContainer>
        </div>
      </ReplayDetailsProviders>
    </div>
  );
}

type BreadcrumbsWithFlowButtonsProps = {
  endBreadcrumbId: string | null;
  filteredFrames: any[];
  hasFilters: boolean;
  onSetEnd: (breadcrumbId: string) => void;
  onSetStart: (breadcrumbId: string) => void;
  startBreadcrumbId: string | null;
};

function SelectFromBreadcrumbsCard({
  startBreadcrumbId,
  endBreadcrumbId,
  onSetStart,
  onSetEnd,
  filteredFrames,
  hasFilters,
}: BreadcrumbsWithFlowButtonsProps) {
  return (
    <Fragment>
      <BreadcrumbsWrapper>
        <BreadcrumbsContainer>
          <Breadcrumbs />
        </BreadcrumbsContainer>
        <FlowButtonColumn>
          {filteredFrames.map((frame, index) => {
            const frameId = getFrameId(frame, index);
            const isStart = startBreadcrumbId === frameId;
            const isEnd = endBreadcrumbId === frameId;
            const endIndex = getFrameIndexById(filteredFrames, endBreadcrumbId ?? '');
            const startIndex = getFrameIndexById(filteredFrames, startBreadcrumbId ?? '');

            return (
              <FlowButtonContainer key={frameId} isStart={isStart} isEnd={isEnd}>
                <FlowButton
                  size="xs"
                  priority={isStart ? 'primary' : 'default'}
                  onClick={() => onSetStart(frameId)}
                  disabled={endBreadcrumbId !== null && index > endIndex}
                >
                  {isStart ? '✓' : 'Start'}
                </FlowButton>
                <FlowButton
                  size="xs"
                  priority={isEnd ? 'primary' : 'default'}
                  onClick={() => onSetEnd(frameId)}
                  disabled={startBreadcrumbId === null || index < startIndex}
                >
                  {isEnd ? '✓' : 'End'}
                </FlowButton>
              </FlowButtonContainer>
            );
          })}
        </FlowButtonColumn>
      </BreadcrumbsWrapper>
    </Fragment>
  );
}

const LayoutContainer = styled('div')`
  display: flex;
  gap: 24px;
  height: calc(100vh - 200px);
`;

const Header = styled(Layout.Header)`
  gap: ${space(1)};
  padding-bottom: ${space(1.5)};
  @media (min-width: ${p => p.theme.breakpoints.md}) {
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

const BreadcrumbItem = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const BreadcrumbLink = styled(Link)`
  color: ${p => p.theme.linkColor};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const BreadcrumbSeparator = styled('span')`
  color: ${p => p.theme.subText};
  margin: 0 ${space(0.5)};
`;

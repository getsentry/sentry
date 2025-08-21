import React, {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import GroupStatusChart from 'sentry/components/charts/groupStatusChart';
import {Text} from 'sentry/components/core/text';
import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';
import {AutofixSolution} from 'sentry/components/events/autofix/autofixSolution';
import {
  AutofixStepType,
  type AutofixChangesStep,
} from 'sentry/components/events/autofix/types';
import {useAiAutofix, useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import ErrorLevel from 'sentry/components/events/errorLevel';
import {StackTraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {SpanEvidenceKeyValueList} from 'sentry/components/events/interfaces/performance/spanEvidenceKeyValueList';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {
  CardRendererProps,
  TypedMissionControlCard,
} from 'sentry/types/missionControl';
import type {Project} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {StackView} from 'sentry/types/stacktrace';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useApiQuery} from 'sentry/utils/queryClient';
import {Divider} from 'sentry/views/issueDetails/divider';

/**
 * Helper function to extract stacktrace from event data
 */
function getStacktraceFromEvent(event: Event): StacktraceType | null {
  const exceptionsWithStacktrace =
    event.entries
      .find(e => e.type === 'exception')
      ?.data?.values.filter(({stacktrace}: any) => stacktrace) ?? [];

  const exceptionStacktrace: StacktraceType | undefined =
    exceptionsWithStacktrace[0]?.stacktrace;

  if (exceptionStacktrace) {
    return exceptionStacktrace;
  }

  const threads = event.entries.find(e => e.type === 'threads')?.data?.values ?? [];
  const bestThread = threads.find((thread: any) => thread.crashed) || threads[0];

  return bestThread?.stacktrace || null;
}

/**
 * Component to render span evidence directly
 */
function DirectSpanEvidencePreview({groupId}: {groupId: string}) {
  const {
    data: event,
    isLoading,
    error,
  } = useApiQuery<EventTransaction>([`/issues/${groupId}/events/latest/`], {
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <LoadingIndicator size={32} />;
  }

  if (error || !event) {
    return <Text variant="muted">{t('Failed to load span evidence')}</Text>;
  }

  return <SpanEvidenceKeyValueList event={event} />;
}

/**
 * Component to render evidence directly
 */
function DirectEvidencePreview({groupId}: {groupId: string}) {
  const {
    data: event,
    isLoading,
    error,
  } = useApiQuery<Event>([`/issues/${groupId}/events/latest/`], {
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <LoadingIndicator size={32} />;
  }

  if (error || !event) {
    return <Text variant="muted">{t('Failed to load evidence')}</Text>;
  }

  const evidenceDisplay = event.occurrence?.evidenceDisplay;

  if (evidenceDisplay?.length) {
    return (
      <KeyValueList
        data={evidenceDisplay.map(item => ({
          key: item.name,
          subject: item.name,
          value: item.value,
        }))}
        shouldSort={false}
      />
    );
  }

  return <Text variant="muted">{t('No evidence available for this issue')}</Text>;
}

/**
 * Component to render stack trace directly
 */
function DirectStackTracePreview({groupId}: {groupId: string}) {
  const {
    data: event,
    isLoading,
    error,
  } = useApiQuery<Event>([`/issues/${groupId}/events/latest/`], {
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <LoadingIndicator size={32} />;
  }

  if (error || !event) {
    return <Text variant="muted">{t('Failed to load stack trace')}</Text>;
  }

  const stacktrace = getStacktraceFromEvent(event);

  if (stacktrace) {
    return (
      <StackTraceContent
        stackView={StackView.APP}
        stacktrace={stacktrace}
        event={event}
        newestFirst
        platform={event.platform || 'other'}
        inlined
        maxDepth={5}
      />
    );
  }

  return <Text variant="muted">{t('No stack trace available for this issue')}</Text>;
}

/**
 * Data structure for issue cards - contains the issue ID and reason
 */
interface IssueCardData {
  issueId: string;
  reason: 'escalating' | 'new' | 'quick fix';
}

/**
 * Typed card type for issue cards
 */
export type IssueCard = TypedMissionControlCard<'issue', IssueCardData>;

/**
 * Issue card component - displays Sentry issues fetched from the API
 */
function IssueCardRenderer({card, onSetPrimaryAction}: CardRendererProps<IssueCardData>) {
  const {issueId, reason} = card.data;

  // Get the appropriate reason message
  const getReasonMessage = (reasonString: IssueCardData['reason']) => {
    switch (reasonString) {
      case 'escalating':
        return t('This issue is escalating.');
      case 'new':
        return t('This issue just started happening.');
      case 'quick fix':
        return t('This issue is probably a quick fix.');
      default:
        return t('This issue needs attention.');
    }
  };

  // Fetch issue data from the API
  const {
    data: issue,
    isLoading,
    error,
  } = useApiQuery<Group>([`/issues/${issueId}/`], {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch latest event for GroupSummaryWithAutofix
  const {data: latestEvent} = useApiQuery<Event>([`/issues/${issueId}/events/latest/`], {
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!issue, // Only fetch when we have issue data
  });

  // Fetch autofix data
  const {data: autofixData, isPending: isAutofixPending} = useAutofixData({
    groupId: issueId,
    isUserWatching: false,
  });

  // Use the proper autofix hook with fallback objects to prevent undefined errors
  const {triggerAutofix} = useAiAutofix(
    issue || ({id: issueId} as any),
    latestEvent || ({id: ''} as any),
    {
      isSidebar: true,
    }
  );

  // Find the project for this issue
  const project: Project | undefined = issue?.project;

  // Helper function to determine the autofix state and last step
  const getAutofixState = useCallback(() => {
    if (!autofixData?.steps?.length) {
      return {state: 'no_autofix', lastStep: null};
    }

    const lastStep = autofixData.steps[autofixData.steps.length - 1];

    if (lastStep?.type === AutofixStepType.ROOT_CAUSE_ANALYSIS) {
      return {state: 'root_cause', lastStep};
    }

    if (lastStep?.type === AutofixStepType.SOLUTION) {
      return {state: 'solution', lastStep};
    }

    if (lastStep?.type === AutofixStepType.CHANGES) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const changesStep = lastStep as AutofixChangesStep;
      const hasPR = changesStep.changes?.some(change => change.pull_request?.pr_url);
      return {
        state: hasPR ? 'changes_with_pr' : 'changes',
        lastStep: changesStep,
      };
    }

    return {state: 'no_autofix', lastStep: null};
  }, [autofixData]);

  // Determine the autofix action based on current state
  const getAutofixAction = useCallback(() => {
    if (!issue || !triggerAutofix) {
      return null;
    }

    // Don't show action while autofix data is loading
    if (isAutofixPending) {
      return null;
    }

    const {state, lastStep} = getAutofixState();

    switch (state) {
      case 'no_autofix':
        return {
          label: 'Find root cause for me',
          handler: async () => {
            await triggerAutofix('');
            addSuccessMessage(
              t('Analysis started. It will be added to this stack when complete.')
            );
          },
          loadingLabel: 'Starting issue fix...',
        };

      case 'root_cause':
        return {
          label: 'Find solution',
          handler: () => {
            // Trigger solution finding (equivalent to clicking "Find Solution" button)
            // This would need to be implemented based on the actual autofix API
            addSuccessMessage(t('Finding solution...'));
            return Promise.resolve();
          },
          loadingLabel: 'Finding solution...',
        };

      case 'solution':
        return {
          label: 'Code it up',
          handler: () => {
            // Trigger code generation (equivalent to clicking "Code It Up" button)
            // This would need to be implemented based on the actual autofix API
            addSuccessMessage(t('Generating code changes...'));
            return Promise.resolve();
          },
          loadingLabel: 'Generating code...',
        };

      case 'changes':
        return {
          label: 'Draft PR',
          handler: () => {
            // Trigger PR creation (equivalent to clicking "Draft PR" button)
            // This would need to be implemented based on the actual autofix API
            addSuccessMessage(t('Creating pull request...'));
            return Promise.resolve();
          },
          loadingLabel: 'Creating PR...',
        };

      case 'changes_with_pr': {
        const changesStep = lastStep as AutofixChangesStep;
        const firstPR = changesStep.changes?.find(change => change.pull_request?.pr_url);
        return {
          label: 'View PR',
          handler: () => {
            if (firstPR?.pull_request?.pr_url) {
              window.open(firstPR.pull_request.pr_url, '_blank', 'noopener,noreferrer');
            }
            return Promise.resolve();
          },
          loadingLabel: 'Opening PR...',
        };
      }

      default:
        return null;
    }
  }, [issue, triggerAutofix, getAutofixState, isAutofixPending]);

  // Determine which preview component to render based on autofix state
  const renderIssuePreview = () => {
    if (!issue?.issueCategory) {
      return null;
    }

    // Show loading indicator while autofix data is being fetched
    if (isAutofixPending) {
      return <LoadingIndicator size={32} />;
    }

    const {state, lastStep} = getAutofixState();

    // Show autofix components based on state
    switch (state) {
      case 'root_cause': {
        const rootCauseStep = lastStep;
        return (
          <AutofixRootCause
            causes={(rootCauseStep as any)?.causes || []}
            groupId={issue.id}
            runId={autofixData?.run_id || ''}
            rootCauseSelection={(rootCauseStep as any)?.selection || {}}
            isRootCauseFirstAppearance={false}
            preview
          />
        );
      }

      case 'solution': {
        const solutionStep = lastStep;
        const rootCauseStepForSolution = autofixData?.steps?.find(
          step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
        );

        return (
          <React.Fragment>
            {rootCauseStepForSolution && (
              <AutofixRootCause
                causes={(rootCauseStepForSolution as any)?.causes || []}
                groupId={issue.id}
                runId={autofixData?.run_id || ''}
                rootCauseSelection={(rootCauseStepForSolution as any)?.selection || {}}
                isRootCauseFirstAppearance={false}
                preview
              />
            )}
            <AutofixSolution
              solution={(solutionStep as any)?.solution || []}
              groupId={issue.id}
              runId={autofixData?.run_id || ''}
              solutionSelected={!!(solutionStep as any)?.selection}
              description={(solutionStep as any)?.description}
              customSolution={(solutionStep as any)?.selection?.custom_solution}
              isSolutionFirstAppearance={false}
              preview
            />
          </React.Fragment>
        );
      }

      case 'changes':
      case 'changes_with_pr': {
        const changesStep = lastStep as AutofixChangesStep;
        return (
          <AutofixChanges
            step={changesStep}
            groupId={issue.id}
            runId={autofixData?.run_id || ''}
            isChangesFirstAppearance={false}
          />
        );
      }

      case 'no_autofix':
      default: {
        // Show original stack trace/evidence preview
        const issueTypeConfig = project
          ? getConfigForIssueType(
              {
                issueCategory: issue.issueCategory,
                issueType: issue.issueType,
              },
              project
            )
          : null;

        if (issueTypeConfig?.spanEvidence.enabled) {
          return (
            <Card>
              <DirectSpanEvidencePreview groupId={issue.id} />
            </Card>
          );
        }

        if (issueTypeConfig?.usesIssuePlatform) {
          return (
            <Card>
              <DirectEvidencePreview groupId={issue.id} />
            </Card>
          );
        }

        return (
          <Card>
            <DirectStackTracePreview groupId={issue.id} />
          </Card>
        );
      }
    }
  };

  // Calculate 24h event count from stats
  const calculate24hEventCount = (stats: Array<[number, number]>) => {
    return (
      stats?.reduce((total, [, count]) => {
        return total + count;
      }, 0) ?? 0
    );
  };

  // Set up the primary action when the component mounts
  useEffect(() => {
    if (issue) {
      const autofixAction = getAutofixAction();
      onSetPrimaryAction(autofixAction);
    } else {
      onSetPrimaryAction(null);
    }

    return () => onSetPrimaryAction(null);
  }, [onSetPrimaryAction, issue, autofixData, getAutofixAction, isAutofixPending]);

  if (isLoading) {
    return (
      <CardContainer>
        <LoadingContainer>
          <LoadingIndicator />
          <Text size="md">Loading issue...</Text>
        </LoadingContainer>
      </CardContainer>
    );
  }

  if (error || !issue) {
    return (
      <CardContainer>
        <ErrorContainer>
          <Text size="lg" bold>
            Failed to load issue
          </Text>
          <Text size="sm" variant="muted">
            Issue ID: {issueId}
          </Text>
        </ErrorContainer>
      </CardContainer>
    );
  }

  return (
    <CardContainer>
      <Content>
        <RowContainer>
          <TitleSection>
            <Text size="xl" variant="muted">
              {getReasonMessage(reason)}
            </Text>

            <Text size="xl" bold>
              {issue.metadata.type}
            </Text>

            <Text size="lg">{issue.metadata.value}</Text>
            <MetadataValueContainer>
              <ErrorLevel level={issue.level} />
              <Text size="sm" variant="muted">
                {issue.culprit}
              </Text>
            </MetadataValueContainer>
            <MetadataValueContainer>
              <Text size="sm" variant={issue.isUnhandled ? 'danger' : 'muted'}>
                {issue.isUnhandled ? t('Unhandled') : t('Handled')}
              </Text>
              <Divider />
              <Text size="sm" variant="muted">
                {issue.substatus
                  ? issue.substatus.toString().charAt(0).toUpperCase() +
                    issue.substatus.toString().slice(1)
                  : ''}
              </Text>
            </MetadataValueContainer>
          </TitleSection>

          {issue.stats?.['24h'] && (
            <GraphContainer>
              <MetricsRow>
                <MetricItem>
                  <MetricLabel>{t('Total Events')}</MetricLabel>
                  <MetricValue>{issue.count.toLocaleString()}</MetricValue>
                  <MetricSubtext>
                    {calculate24hEventCount(issue.stats['24h']).toLocaleString()} in last
                    24h
                  </MetricSubtext>
                </MetricItem>
                <MetricItem>
                  <MetricLabel>{t('Users Affected')}</MetricLabel>
                  <MetricValue>{issue.userCount.toLocaleString()}</MetricValue>
                </MetricItem>
                <MetricItem>
                  <MetricLabel>{t('First Seen')}</MetricLabel>
                  <MetricValue>
                    <TimeSince
                      date={issue.firstSeen}
                      unitStyle="short"
                      suffix=""
                      aria-label={t('First Seen')}
                      tooltipPrefix={t('First Seen')}
                    />
                  </MetricValue>
                </MetricItem>
                <MetricItem>
                  <MetricLabel>{t('Last Seen')}</MetricLabel>
                  <MetricValue>
                    <TimeSince
                      date={issue.lastSeen}
                      suffix="ago"
                      unitStyle="short"
                      aria-label={t('Last Seen')}
                      tooltipPrefix={t('Last Seen')}
                    />
                  </MetricValue>
                </MetricItem>
              </MetricsRow>
              <GroupStatusChart
                hideZeros
                loading={false}
                stats={issue.stats['24h']}
                showMarkLine
              />
            </GraphContainer>
          )}
        </RowContainer>

        <IssueDetailsContainer>
          <IssuePreviewContainer>{renderIssuePreview()}</IssuePreviewContainer>
        </IssueDetailsContainer>
      </Content>
    </CardContainer>
  );
}

const CardContainer = styled('div')`
  padding: ${space(4)};
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  height: 100%;
`;

const LoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: ${space(2)};
`;

const ErrorContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: ${space(1)};
  text-align: center;
`;

const Content = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const RowContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(4)};
  align-items: center;
`;

const TitleSection = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const MetadataValueContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const GraphContainer = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const MetricsRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(2)};
`;

const MetricItem = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
`;

const MetricValue = styled(Text)`
  font-size: ${p => p.theme.fontSize.lg};
  margin-top: ${p => p.theme.space.sm};
`;

const MetricSubtext = styled(Text)`
  font-size: 12px;
  color: ${p => p.theme.subText};
  margin-top: ${space(0.5)};
`;

const MetricLabel = styled(Text)`
  font-size: 12px;
  color: ${p => p.theme.subText};
  margin-top: ${space(0.5)};
`;

const IssueDetailsContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-top: ${space(3)};
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    flex-direction: column;
  }
`;

const IssuePreviewContainer = styled('div')`
  flex: 7;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  max-height: 500px;
  overflow-y: auto;
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    order: 2;
  }
`;

const Card = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;

export default IssueCardRenderer;

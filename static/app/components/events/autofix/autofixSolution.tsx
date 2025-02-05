import {useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ClippedBox from 'sentry/components/clippedBox';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {
  type AutofixRepository,
  type AutofixSolutionTimelineEvent,
  AutofixStatus,
  AutofixStepType,
  type AutofixTimelineEvent,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
} from 'sentry/components/events/autofix/useAutofix';
import {IconClose, IconEdit, IconEllipsis, IconFix} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

import AutofixHighlightPopup from './autofixHighlightPopup';
import {AutofixTimeline} from './autofixTimeline';
import {useTextSelection} from './useTextSelection';

export function useSelectSolution({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      params:
        | {}
        | {
            customSolution: string;
          }
    ) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data:
          'customSolution' in params
            ? {
                run_id: runId,
                payload: {
                  type: 'select_solution',
                  custom_solution: params.customSolution,
                },
              }
            : {
                run_id: runId,
                payload: {
                  type: 'select_solution',
                },
              },
      });
    },
    onSuccess: (_, params) => {
      setApiQueryData<AutofixResponse>(
        queryClient,
        makeAutofixQueryKey(groupId),
        data => {
          if (!data || !data.autofix) {
            return data;
          }

          return {
            ...data,
            autofix: {
              ...data.autofix,
              status: AutofixStatus.PROCESSING,
              steps: data.autofix.steps?.map(step => {
                if (step.type !== AutofixStepType.SOLUTION) {
                  return step;
                }

                return {
                  ...step,
                  selection:
                    'customSolution' in params
                      ? {
                          custom_solution: params.customSolution,
                        }
                      : {},
                };
              }),
            },
          };
        }
      );
      addSuccessMessage("Great, let's move forward with this solution.");
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when selecting the solution.'));
    },
  });
}

type AutofixSolutionProps = {
  groupId: string;
  repos: AutofixRepository[];
  runId: string;
  solution: AutofixSolutionTimelineEvent[];
  solutionSelected: boolean;
  customSolution?: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
};

const cardAnimationProps: AnimationProps = {
  exit: {opacity: 0, height: 0, scale: 0.8, y: -20},
  initial: {opacity: 0, height: 0, scale: 0.8},
  animate: {opacity: 1, height: 'auto', scale: 1},
  transition: testableTransition({
    duration: 1.0,
    height: {
      type: 'spring',
      bounce: 0.2,
    },
    scale: {
      type: 'spring',
      bounce: 0.2,
    },
    y: {
      type: 'tween',
      ease: 'easeOut',
    },
  }),
};

const VerticalEllipsis = styled(IconEllipsis)`
  height: 16px;
  color: ${p => p.theme.subText};
  transform: rotate(90deg);
  position: relative;
  left: -1px;
`;

type ExtendedTimelineEvent = AutofixTimelineEvent & {
  isTruncated?: boolean;
  originalIndex?: number;
};

function SolutionDescription({
  solution,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
}: {
  groupId: string;
  runId: string;
  solution: AutofixSolutionTimelineEvent[];
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selection = useTextSelection(containerRef);

  // Filter events to keep only 1 event before and after modified events
  const filteredEvents = (() => {
    const events = solution.map((event, index) => ({
      ...event,
      is_most_important_event: event.is_new_event,
      originalIndex: index,
    }));

    const firstModifiedIndex = events.findIndex(e => e.is_new_event);
    const lastModifiedIndex = events.findLastIndex(e => e.is_new_event);

    if (firstModifiedIndex === -1) {
      return events;
    }

    const startIndex = Math.max(0, firstModifiedIndex - 1);
    const endIndex = Math.min(events.length - 1, lastModifiedIndex + 1);

    const truncatedEvents = events.slice(startIndex, endIndex + 1);

    if (truncatedEvents.length === 0) {
      return events;
    }

    // Add truncation indicators if needed
    const finalEvents: ExtendedTimelineEvent[] = [];

    // Add truncation at start if we removed events
    if (startIndex > 0) {
      const firstEvent = truncatedEvents[0];
      if (firstEvent) {
        finalEvents.push({
          title: '',
          timeline_item_type: 'internal_code' as const,
          code_snippet_and_analysis: '',
          relevant_code_file: firstEvent.relevant_code_file,
          is_most_important_event: false,
          isTruncated: true,
        });
      }
    }

    // Add all filtered events
    finalEvents.push(...truncatedEvents);

    // Add truncation at end if we removed events
    if (endIndex < events.length - 1) {
      const lastEvent = truncatedEvents[truncatedEvents.length - 1];
      if (lastEvent) {
        finalEvents.push({
          title: '',
          timeline_item_type: 'internal_code' as const,
          code_snippet_and_analysis: '',
          relevant_code_file: lastEvent.relevant_code_file,
          is_most_important_event: false,
          isTruncated: true,
        });
      }
    }

    return finalEvents;
  })();

  return (
    <SolutionDescriptionWrapper>
      <AnimatePresence>
        {selection && (
          <AutofixHighlightPopup
            selectedText={selection.selectedText}
            referenceElement={selection.referenceElement}
            groupId={groupId}
            runId={runId}
            stepIndex={previousDefaultStepIndex ?? 0}
            retainInsightCardIndex={
              previousInsightCount !== undefined && previousInsightCount >= 0
                ? previousInsightCount - 1
                : -1
            }
          />
        )}
      </AnimatePresence>
      <div ref={containerRef}>
        <AutofixTimeline
          events={filteredEvents}
          activeColor="green400"
          getCustomIcon={(event: AutofixTimelineEvent & {isTruncated?: boolean}) =>
            event.isTruncated ? <VerticalEllipsis /> : undefined
          }
        />
      </div>
    </SolutionDescriptionWrapper>
  );
}

function formatSolutionText(solution: AutofixSolutionTimelineEvent[]) {
  if (!solution || solution.length === 0) {
    return '';
  }

  return solution.map(event => `- ${event.title}`).join('\n');
}

function CopySolutionButton({solution}: {solution: AutofixSolutionTimelineEvent[]}) {
  const text = formatSolutionText(solution);
  return <CopyToClipboardButton size="sm" text={text} borderless />;
}

function AutofixSolutionDisplay({
  solution,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
  customSolution,
  solutionSelected,
}: Omit<AutofixSolutionProps, 'repos'>) {
  const {mutate: handleContinue, isPending} = useSelectSolution({groupId, runId});
  const [isEditing, setIsEditing] = useState(false);
  const [userCustomSolution, setUserCustomSolution] = useState('');

  if (!solution || solution.length === 0) {
    return <Alert type="error">{t('No solution available.')}</Alert>;
  }

  if (customSolution) {
    return (
      <SolutionContainer>
        <CustomSolutionPadding>
          <HeaderWrapper>
            <HeaderText>
              <IconFix size="sm" />
              {t('Custom Solution')}
            </HeaderText>
            <CopySolutionButton solution={solution} />
          </HeaderWrapper>
          <Content>
            <SolutionDescriptionWrapper>{customSolution}</SolutionDescriptionWrapper>
          </Content>
        </CustomSolutionPadding>
      </SolutionContainer>
    );
  }

  const showCodeButton = isEditing || !solutionSelected;

  return (
    <SolutionContainer>
      <ClippedBox clipHeight={408}>
        <HeaderWrapper>
          <HeaderText>
            <IconFix size="sm" />
            {t('Solution')}
          </HeaderText>
          <ButtonBar gap={1}>
            <ButtonBar>
              {!isEditing && <CopySolutionButton solution={solution} />}
              <EditButton
                size="sm"
                borderless
                title={isEditing ? t('Cancel') : t('Propose your own solution')}
                onClick={() => {
                  if (isEditing) {
                    setIsEditing(false);
                    setUserCustomSolution('');
                  } else {
                    setIsEditing(true);
                  }
                }}
              >
                {isEditing ? <IconClose size="sm" /> : <IconEdit size="sm" />}
              </EditButton>
            </ButtonBar>
            {showCodeButton && (
              <Button
                size="sm"
                priority="primary"
                busy={isPending}
                onClick={() => {
                  if (isEditing) {
                    if (userCustomSolution.trim()) {
                      handleContinue({customSolution: userCustomSolution.trim()});
                    }
                  } else {
                    handleContinue({});
                  }
                }}
              >
                {t('Code It Up')}
              </Button>
            )}
          </ButtonBar>
        </HeaderWrapper>
        <Content>
          {isEditing ? (
            <TextArea
              value={customSolution}
              onChange={e => {
                setUserCustomSolution(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={5}
              autoFocus
              placeholder={t('Propose your own solution...')}
            />
          ) : (
            <SolutionDescription
              solution={solution}
              groupId={groupId}
              runId={runId}
              previousDefaultStepIndex={previousDefaultStepIndex}
              previousInsightCount={previousInsightCount}
            />
          )}
        </Content>
      </ClippedBox>
    </SolutionContainer>
  );
}

export function AutofixSolution(props: AutofixSolutionProps) {
  if (props.solution.length === 0) {
    return (
      <AnimatePresence initial>
        <AnimationWrapper key="card" {...cardAnimationProps}>
          <NoSolutionPadding>
            <Alert type="warning">{t('No solution found.')}</Alert>
          </NoSolutionPadding>
        </AnimationWrapper>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <AutofixSolutionDisplay {...props} />
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const NoSolutionPadding = styled('div')`
  padding: 0 ${space(2)};
`;

const SolutionContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const Content = styled('div')`
  padding: ${space(1)} 0;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: ${space(0.5)};
  padding-bottom: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
  gap: ${space(1)};
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SolutionDescriptionWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-top: ${space(1)};
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

const TextArea = styled('textarea')`
  width: 100%;
  min-height: 150px;
  border: none;
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.4;
  resize: none;
  overflow: hidden;
  &:focus {
    outline: none;
  }
`;

const EditButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const CustomSolutionPadding = styled('div')`
  padding: ${space(1)} ${space(0.25)} ${space(2)} ${space(0.25)};
`;

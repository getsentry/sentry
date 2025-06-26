import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ClippedBox from 'sentry/components/clippedBox';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {Tooltip} from 'sentry/components/core/tooltip';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {SolutionEventItem} from 'sentry/components/events/autofix/autofixSolutionEventItem';
import {
  type AutofixSolutionTimelineEvent,
  AutofixStatus,
  AutofixStepType,
  type CommentThread,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
  useAutofixRepos,
} from 'sentry/components/events/autofix/useAutofix';
import Link from 'sentry/components/links/link';
import {Timeline} from 'sentry/components/timeline';
import {IconAdd, IconChat, IconFix} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

import AutofixHighlightPopup from './autofixHighlightPopup';

function useSelectSolution({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;

  return useMutation({
    mutationFn: (params: {
      mode: 'all' | 'fix' | 'test';
      solution: AutofixSolutionTimelineEvent[];
    }) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'select_solution',
              mode: params.mode,
              solution: params.solution,
            },
          },
        }
      );
    },
    onSuccess: (_, params) => {
      setApiQueryData<AutofixResponse>(
        queryClient,
        makeAutofixQueryKey(orgSlug, groupId),
        data => {
          if (!data?.autofix) {
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
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, true),
      });
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, false),
      });
      addSuccessMessage('On it.');
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when selecting the solution.'));
    },
  });
}

type AutofixSolutionProps = {
  groupId: string;
  runId: string;
  solution: AutofixSolutionTimelineEvent[];
  solutionSelected: boolean;
  agentCommentThread?: CommentThread;
  changesDisabled?: boolean;
  customSolution?: string;
  description?: string;
  isSolutionFirstAppearance?: boolean;
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

function SolutionDescription({
  solution,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
  description,
  onDeleteItem,
  onToggleActive,
  ref,
}: {
  groupId: string;
  onDeleteItem: (index: number) => void;
  onToggleActive: (index: number) => void;
  runId: string;
  solution: AutofixSolutionTimelineEvent[];
  description?: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <SolutionDescriptionWrapper>
      {description && (
        <AutofixHighlightWrapper
          ref={ref}
          groupId={groupId}
          runId={runId}
          stepIndex={previousDefaultStepIndex ?? 0}
          retainInsightCardIndex={
            previousInsightCount !== undefined && previousInsightCount >= 0
              ? previousInsightCount
              : null
          }
        >
          <Description
            dangerouslySetInnerHTML={{__html: singleLineRenderer(description)}}
          />
        </AutofixHighlightWrapper>
      )}
      <SolutionEventList
        events={solution}
        onDeleteItem={onDeleteItem}
        onToggleActive={onToggleActive}
        groupId={groupId}
        runId={runId}
        stepIndex={previousDefaultStepIndex ?? 0}
        retainInsightCardIndex={
          previousInsightCount !== undefined && previousInsightCount >= 0
            ? previousInsightCount
            : null
        }
      />
    </SolutionDescriptionWrapper>
  );
}

const Description = styled('div')`
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding-bottom: ${space(2)};
  margin-bottom: ${space(2)};
`;

type SolutionEventListProps = {
  events: AutofixSolutionTimelineEvent[];
  groupId: string;
  onDeleteItem: (index: number) => void;
  onToggleActive: (index: number) => void;
  runId: string;
  retainInsightCardIndex?: number | null;
  stepIndex?: number;
};

function SolutionEventList({
  events,
  onDeleteItem,
  onToggleActive,
  groupId,
  runId,
  stepIndex = 0,
  retainInsightCardIndex = null,
}: SolutionEventListProps) {
  if (!events?.length) {
    return null;
  }

  return (
    <Timeline.Container>
      {events.map((event, index) => {
        const isSelected = event.is_active !== false; // Default to true if is_active is undefined

        return (
          <SolutionEventItem
            key={index}
            event={event}
            index={index}
            isSelected={isSelected}
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={retainInsightCardIndex}
            onDeleteItem={onDeleteItem}
            onToggleActive={onToggleActive}
          />
        );
      })}
    </Timeline.Container>
  );
}

export function formatSolutionText(
  solution: AutofixSolutionTimelineEvent[],
  customSolution?: string
) {
  if (!solution && !customSolution) {
    return '';
  }

  if (customSolution) {
    return `# Proposed Changes\n\n${customSolution}`;
  }

  if (!solution || solution.length === 0) {
    return '';
  }

  const parts = ['# Proposed Changes'];

  parts.push(
    solution
      .filter(event => event.is_active)
      .map(event => {
        const eventParts = [`### ${event.title}`];

        if (event.code_snippet_and_analysis) {
          eventParts.push(event.code_snippet_and_analysis);
        }

        if (event.relevant_code_file) {
          eventParts.push(`(See ${event.relevant_code_file.file_path})`);
        }

        return eventParts.join('\n');
      })
      .join('\n\n')
  );

  return parts.join('\n\n');
}

function CopySolutionButton({
  solution,
  customSolution,
  isEditing,
}: {
  solution: AutofixSolutionTimelineEvent[];
  customSolution?: string;
  isEditing?: boolean;
}) {
  if (isEditing) {
    return null;
  }
  const text = formatSolutionText(solution, customSolution);
  return (
    <CopyToClipboardButton
      size="sm"
      text={text}
      borderless
      title="Copy solution as Markdown"
      analyticsEventName="Autofix: Copy Solution as Markdown"
      analyticsEventKey="autofix.solution.copy"
    />
  );
}

function AutofixSolutionDisplay({
  solution,
  description,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
  customSolution,
  solutionSelected,
  agentCommentThread,
}: Omit<AutofixSolutionProps, 'repos'>) {
  const organization = useOrganization();
  const {data: group} = useGroup({groupId});
  const project = group?.project;

  const {repos} = useAutofixRepos(groupId);
  const {mutate: handleContinue, isPending} = useSelectSolution({groupId, runId});
  const [isEditing, _setIsEditing] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [solutionItems, setSolutionItems] = useState<AutofixSolutionTimelineEvent[]>( // This will become outdated if multiple people use it, but we can ignore this for now.
    () => {
      // Initialize is_active to true for all items that don't have it set for backwards compatibility
      return solution.map(item => ({
        ...item,
        is_active: item.is_active === undefined ? true : item.is_active,
      }));
    }
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const iconFixRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);

  const handleSelectDescription = () => {
    if (descriptionRef.current) {
      // Simulate a click on the description to trigger the text selection
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      descriptionRef.current.dispatchEvent(clickEvent);
    }
  };

  const hasNoRepos = repos.length === 0;
  const cantReadRepos = repos.every(repo => repo.is_readable === false);

  const handleAddInstruction = () => {
    if (instructions.trim()) {
      // Create a new step from the instructions input
      const newStep: AutofixSolutionTimelineEvent = {
        title: instructions,
        timeline_item_type: 'human_instruction',
        is_most_important_event: false,
        is_active: true,
      };

      // Add the new step to the solution
      setSolutionItems([...solutionItems, newStep]);

      // Clear the input
      setInstructions('');

      trackAnalytics('autofix.solution.add_step', {
        organization,
        solution: solutionItems,
        newStep,
      });
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleAddInstruction();
  };

  const handleDeleteItem = useCallback(
    (index: number) => {
      setSolutionItems(current => current.filter((_, i) => i !== index));

      trackAnalytics('autofix.solution.delete_step', {
        organization,
        solution: solutionItems,
        deletedStep: solutionItems[index],
      });
    },
    [organization, solutionItems]
  );

  const handleToggleActive = useCallback(
    (index: number) => {
      setSolutionItems(current =>
        current.map((item, i) =>
          i === index
            ? {...item, is_active: item.is_active === false ? true : false}
            : item
        )
      );

      trackAnalytics('autofix.solution.toggle_step', {
        organization,
        solution: solutionItems,
        toggledStep: solutionItems[index],
      });
    },
    [organization, solutionItems]
  );

  useEffect(() => {
    setSolutionItems(
      solution.map(item => ({
        ...item,
        is_active: item.is_active === undefined ? true : item.is_active,
      }))
    );
  }, [solution]);

  if (!solution || solution.length === 0) {
    return (
      <Alert.Container>
        <Alert type="error">{t('No solution available.')}</Alert>
      </Alert.Container>
    );
  }

  if (customSolution) {
    return (
      <SolutionContainer>
        <CustomSolutionPadding>
          <HeaderWrapper>
            <HeaderText>
              <HeaderIconWrapper ref={iconFixRef}>
                <IconFix size="sm" color="green400" />
              </HeaderIconWrapper>
              {t('Custom Solution')}
            </HeaderText>
            <CopySolutionButton solution={solution} customSolution={customSolution} />
          </HeaderWrapper>
          <Content>
            <SolutionDescriptionWrapper>{customSolution}</SolutionDescriptionWrapper>
          </Content>
        </CustomSolutionPadding>
      </SolutionContainer>
    );
  }

  return (
    <SolutionContainer ref={containerRef}>
      <ClippedBox clipHeight={408}>
        <HeaderWrapper>
          <HeaderText>
            <HeaderIconWrapper ref={iconFixRef}>
              <IconFix size="sm" color="green400" />
            </HeaderIconWrapper>
            {t('Solution')}
            <ChatButton
              size="zero"
              borderless
              title={t('Chat with Seer')}
              onClick={handleSelectDescription}
              analyticsEventName="Autofix: Solution Chat"
              analyticsEventKey="autofix.solution.chat"
            >
              <IconChat size="xs" />
            </ChatButton>
          </HeaderText>
          <ButtonBar gap={1}>
            <ButtonBar>
              {!isEditing && (
                <CopySolutionButton solution={solution} isEditing={isEditing} />
              )}
            </ButtonBar>
            <ButtonBar>
              <Tooltip
                isHoverable
                title={
                  hasNoRepos
                    ? tct(
                        'Seer needs to be able to access your repos to write code for you. [link:Manage your integration and working repos here.]',
                        {
                          link: (
                            <Link
                              to={`/settings/${organization.slug}/projects/${project?.slug}/seer/`}
                            />
                          ),
                        }
                      )
                    : cantReadRepos
                      ? t(
                          "Seer can't access any of your repos. Check your GitHub integration and configure repository access for Seer to write code for you."
                        )
                      : undefined
                }
              >
                <Button
                  size="sm"
                  priority={
                    !solutionSelected || !valueIsEqual(solutionItems, solution, true)
                      ? 'primary'
                      : 'default'
                  }
                  busy={isPending}
                  disabled={hasNoRepos || cantReadRepos}
                  onClick={() => {
                    handleContinue({
                      mode: 'fix',
                      solution: solutionItems,
                    });
                  }}
                  analyticsEventName="Autofix: Code It Up"
                  analyticsEventKey="autofix.solution.code"
                >
                  {t('Code It Up')}
                </Button>
              </Tooltip>
            </ButtonBar>
          </ButtonBar>
        </HeaderWrapper>
        <AnimatePresence>
          {agentCommentThread && iconFixRef.current && (
            <AutofixHighlightPopup
              selectedText=""
              referenceElement={iconFixRef.current}
              groupId={groupId}
              runId={runId}
              stepIndex={previousDefaultStepIndex ?? 0}
              retainInsightCardIndex={
                previousInsightCount !== undefined && previousInsightCount >= 0
                  ? previousInsightCount
                  : null
              }
              isAgentComment
              blockName={t('Seer is uncertain of the solution...')}
            />
          )}
        </AnimatePresence>
        <Content>
          <SolutionDescription
            solution={solutionItems}
            groupId={groupId}
            runId={runId}
            description={description}
            previousDefaultStepIndex={previousDefaultStepIndex}
            previousInsightCount={previousInsightCount}
            onDeleteItem={handleDeleteItem}
            onToggleActive={handleToggleActive}
            ref={descriptionRef}
          />
          <AddInstructionWrapper>
            <InstructionsInputWrapper onSubmit={handleFormSubmit}>
              <InstructionsInput
                type="text"
                name="additional-instructions"
                placeholder={t('Add more instructions...')}
                value={instructions}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInstructions(e.target.value)
                }
                size="sm"
              />
              <SubmitButton
                size="zero"
                type="submit"
                borderless
                disabled={!instructions.trim()}
                aria-label={t('Add to solution')}
              >
                <IconAdd size="xs" />
              </SubmitButton>
            </InstructionsInputWrapper>
          </AddInstructionWrapper>
        </Content>
      </ClippedBox>
    </SolutionContainer>
  );
}

export function AutofixSolution(props: AutofixSolutionProps) {
  if (props.solution.length === 0) {
    return (
      <AnimatePresence initial={props.isSolutionFirstAppearance}>
        <AnimationWrapper key="card" {...cardAnimationProps}>
          <NoSolutionPadding>
            <Alert type="warning">{t('No solution found.')}</Alert>
          </NoSolutionPadding>
        </AnimationWrapper>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={props.isSolutionFirstAppearance}>
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
  padding: ${space(1)} 0 0;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SolutionDescriptionWrapper = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  margin-top: ${space(0.5)};
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

const CustomSolutionPadding = styled('div')`
  padding: ${space(1)} ${space(0.25)} ${space(2)} ${space(0.25)};
`;

const HeaderIconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const InstructionsInputWrapper = styled('form')`
  display: flex;
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  margin-top: ${space(0.5)};
  margin-right: ${space(0.25)};
`;

const InstructionsInput = styled(Input)`
  flex-grow: 1;
  padding-right: ${space(4)};

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

const SubmitButton = styled(Button)`
  position: absolute;
  right: ${space(1)};
  top: 50%;
  transform: translateY(-50%);
  height: 24px;
  width: 24px;
  border-radius: 5px;
`;

const AddInstructionWrapper = styled('div')`
  padding: ${space(1)} ${space(1)} 0 ${space(3)};
`;

const ChatButton = styled(Button)`
  color: ${p => p.theme.subText};
  margin-left: -${space(0.5)};
`;

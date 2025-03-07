import {useCallback, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Chevron} from 'sentry/components/chevron';
import ClippedBox from 'sentry/components/clippedBox';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Alert} from 'sentry/components/core/alert';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  type AutofixRepository,
  type AutofixSolutionTimelineEvent,
  AutofixStatus,
  AutofixStepType,
  type CommentThread,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
} from 'sentry/components/events/autofix/useAutofix';
import {Timeline} from 'sentry/components/timeline';
import {
  IconAdd,
  IconCheckmark,
  IconChevron,
  IconClose,
  IconCode,
  IconDelete,
  IconFix,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import type {Color} from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';

import AutofixHighlightPopup from './autofixHighlightPopup';
import {useTextSelection} from './useTextSelection';

export function useSelectSolution({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      mode: 'all' | 'fix' | 'test';
      solution: AutofixSolutionTimelineEvent[];
    }) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: runId,
          payload: {
            type: 'select_solution',
            mode: params.mode,
            solution: params.solution,
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
  agentCommentThread?: CommentThread;
  changesDisabled?: boolean;
  customSolution?: string;
  description?: string;
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
}: {
  groupId: string;
  onDeleteItem: (index: number) => void;
  onToggleActive: (index: number) => void;
  runId: string;
  solution: AutofixSolutionTimelineEvent[];
  description?: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selection = useTextSelection(containerRef);

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
                ? previousInsightCount
                : null
            }
          />
        )}
      </AnimatePresence>
      <div ref={containerRef}>
        {description && (
          <p dangerouslySetInnerHTML={{__html: singleLineRenderer(description)}} />
        )}
        <SolutionEventList
          events={solution}
          onDeleteItem={onDeleteItem}
          onToggleActive={onToggleActive}
        />
      </div>
    </SolutionDescriptionWrapper>
  );
}

type SolutionEventListProps = {
  events: AutofixSolutionTimelineEvent[];
  onDeleteItem: (index: number) => void;
  onToggleActive: (index: number) => void;
};

function SolutionEventList({
  events,
  onDeleteItem,
  onToggleActive,
}: SolutionEventListProps) {
  // Track which events are expanded
  const [expandedItems, setExpandedItems] = useState<number[]>(() => {
    if (!events?.length || events.length > 3) {
      return [];
    }

    // For 3 or fewer items, find the first highlighted item or default to first item
    const firstHighlightedIndex = events.findIndex(
      event => event.is_most_important_event
    );
    return [firstHighlightedIndex !== -1 ? firstHighlightedIndex : 0];
  });

  const toggleItem = useCallback((index: number) => {
    setExpandedItems(current =>
      current.includes(index) ? current.filter(i => i !== index) : [...current, index]
    );
  }, []);

  if (!events?.length) {
    return null;
  }

  return (
    <Timeline.Container>
      {events.map((event, index) => {
        const isSelected = event.is_active !== false; // Default to true if is_active is undefined
        const isActive = event.is_most_important_event && index !== events.length - 1;
        const isExpanded = expandedItems.includes(index);
        const isHumanAction = event.timeline_item_type === 'human_instruction';

        return (
          <Timeline.Item
            key={index}
            title={
              <StyledTimelineHeader
                onClick={() => toggleItem(index)}
                isActive={isActive}
                isSelected={isSelected}
                data-test-id={`autofix-solution-timeline-item-${index}`}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: singleLineRenderer(event.title),
                  }}
                />
                <IconWrapper>
                  {!isHumanAction && (
                    <StyledIconChevron
                      direction={isExpanded ? 'down' : 'right'}
                      size="xs"
                    />
                  )}
                  <SelectionButtonWrapper>
                    <SelectionButton
                      onClick={e => {
                        e.stopPropagation();
                        if (isHumanAction) {
                          onDeleteItem(index);
                        } else {
                          onToggleActive(index);
                        }
                      }}
                      aria-label={isSelected ? t('Deselect item') : t('Select item')}
                    >
                      {isHumanAction ? (
                        <IconDelete size="xs" />
                      ) : isSelected ? (
                        <IconClose size="xs" />
                      ) : (
                        <IconAdd size="xs" />
                      )}
                    </SelectionButton>
                  </SelectionButtonWrapper>
                </IconWrapper>
              </StyledTimelineHeader>
            }
            isActive={isActive}
            icon={getEventIcon(event.timeline_item_type)}
            colorConfig={getEventColor(isActive, isSelected)}
          >
            {event.code_snippet_and_analysis && (
              <AnimatePresence>
                {isExpanded && (
                  <AnimatedContent
                    initial={{height: 0, opacity: 0}}
                    animate={{height: 'auto', opacity: 1}}
                    exit={{height: 0, opacity: 0}}
                    transition={{duration: 0.2}}
                  >
                    <Timeline.Text>
                      <StyledSpan
                        dangerouslySetInnerHTML={{
                          __html: singleLineRenderer(event.code_snippet_and_analysis),
                        }}
                      />
                    </Timeline.Text>
                  </AnimatedContent>
                )}
              </AnimatePresence>
            )}
          </Timeline.Item>
        );
      })}
    </Timeline.Container>
  );
}

function getEventIcon(eventType: string) {
  const iconProps = {
    style: {
      margin: 3,
    },
  };

  switch (eventType) {
    case 'internal_code':
      return <IconCode {...iconProps} />;
    case 'human_instruction':
      return <IconUser {...iconProps} />;
    default:
      return <IconCode {...iconProps} />;
  }
}

interface ColorConfig {
  icon: Color;
  iconBorder: Color;
  title: Color;
}

function getEventColor(isActive?: boolean, isSelected?: boolean): ColorConfig {
  return {
    title: isActive && isSelected ? 'gray400' : 'gray400',
    icon: isSelected ? (isActive ? 'green400' : 'gray400') : 'gray200',
    iconBorder: isSelected ? (isActive ? 'green400' : 'gray400') : 'gray200',
  };
}

function formatSolutionText(
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
  return <CopyToClipboardButton size="sm" text={text} borderless />;
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
  changesDisabled,
  agentCommentThread,
}: Omit<AutofixSolutionProps, 'repos'>) {
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
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleAddInstruction();
  };

  const handleDeleteItem = useCallback((index: number) => {
    setSolutionItems(current => current.filter((_, i) => i !== index));
  }, []);

  const handleToggleActive = useCallback((index: number) => {
    setSolutionItems(current =>
      current.map((item, i) =>
        i === index ? {...item, is_active: item.is_active === false ? true : false} : item
      )
    );
  }, []);

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
              <div ref={iconFixRef}>
                <IconFix size="sm" />
              </div>
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
            <div ref={iconFixRef}>
              <IconFix size="sm" />
            </div>
            {t('Solution')}
          </HeaderText>
          <ButtonBar gap={1}>
            <ButtonBar>
              {!isEditing && (
                <CopySolutionButton solution={solution} isEditing={isEditing} />
              )}
            </ButtonBar>
            <ButtonBar merged>
              <CodeButton
                title={
                  changesDisabled
                    ? t(
                        'You need to set up the GitHub integration for Autofix to write code for you.'
                      )
                    : undefined
                }
                size="sm"
                priority={solutionSelected ? 'default' : 'primary'}
                busy={isPending}
                disabled={changesDisabled}
                onClick={() => {
                  handleContinue({
                    mode: 'fix',
                    solution: solutionItems,
                  });
                }}
              >
                {t('Code It Up')}
              </CodeButton>
              <DropdownMenu
                isDisabled={changesDisabled}
                offset={[-12, 8]}
                items={[
                  {
                    key: 'fix',
                    label: 'Write the fix',
                    details: 'Autofix will implement this solution.',
                    onAction: () =>
                      handleContinue({
                        mode: 'fix',
                        solution: solutionItems,
                      }),
                    leadingItems: <IconCheckmark size="sm" color="purple300" />,
                  },
                  {
                    key: 'test',
                    label: 'Write a reproduction test',
                    details:
                      'Autofix will write a unit test to reproduce the issue and validate future fixes.',
                    onAction: () =>
                      handleContinue({
                        mode: 'test',
                        solution: solutionItems,
                      }),
                    leadingItems: <div style={{width: 16}} />,
                  },
                  {
                    key: 'all',
                    label: 'Write both',
                    details:
                      'Autofix will implement this solution and a test to validate the issue is fixed.',
                    onAction: () =>
                      handleContinue({
                        mode: 'all',
                        solution: solutionItems,
                      }),
                    leadingItems: <div style={{width: 16}} />,
                  },
                ]}
                position="bottom-end"
                trigger={(triggerProps, isOpen) => (
                  <DropdownButton
                    size="sm"
                    priority={solutionSelected ? 'default' : 'primary'}
                    aria-label={t('More coding options')}
                    icon={
                      <Chevron
                        light
                        color="subText"
                        weight="medium"
                        direction={isOpen ? 'up' : 'down'}
                      />
                    }
                    {...triggerProps}
                  />
                )}
              />
            </ButtonBar>
          </ButtonBar>
        </HeaderWrapper>
        <AnimatePresence>
          {agentCommentThread && iconFixRef.current && (
            <AutofixHighlightPopup
              selectedText="Solution"
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
          />
          <AddInstructionWrapper>
            <InstructionsInputWrapper>
              <form onSubmit={handleFormSubmit} style={{display: 'flex', width: '100%'}}>
                <InstructionsInput
                  type="text"
                  name="additional-instructions"
                  placeholder={t('Add additional instructions for Autofix...')}
                  value={instructions}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setInstructions(e.target.value)
                  }
                />
                <AddStepButton
                  type="submit"
                  size="xs"
                  disabled={!instructions.trim()}
                  aria-label={t('Add to solution')}
                  icon={<IconAdd size="xs" />}
                >
                  <span>{t('Add')}</span>
                </AddStepButton>
              </form>
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
      <AnimatePresence initial>
        <AnimationWrapper key="card" {...cardAnimationProps}>
          <NoSolutionPadding>
            <Alert type="warning">{t('No solution found.')}</Alert>
          </NoSolutionPadding>
        </AnimationWrapper>
      </AnimatePresence>
    );
  }

  const changesDisabled = props.repos.every(repo => repo.is_readable === false);

  return (
    <AnimatePresence initial>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <AutofixSolutionDisplay {...props} changesDisabled={changesDisabled} />
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

const CustomSolutionPadding = styled('div')`
  padding: ${space(1)} ${space(0.25)} ${space(2)} ${space(0.25)};
`;

const DropdownButton = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  border-left: none;
`;

const CodeButton = styled(Button)`
  ${p =>
    p.priority === 'primary' &&
    css`
      &::after {
        content: '';
        position: absolute;
        top: -1px;
        bottom: -1px;
        right: -1px;
        border-right: solid 1px currentColor;
        opacity: 0.25;
      }
    `}
`;

const AnimatedContent = styled(motion.div)`
  overflow: hidden;
`;

const StyledSpan = styled('span')`
  & code {
    font-size: ${p => p.theme.fontSizeExtraSmall};
    display: inline-block;
  }
`;

const StyledTimelineHeader = styled('div')<{isSelected: boolean; isActive?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${space(0.25)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  font-weight: ${p => (p.isActive ? p.theme.fontWeightBold : p.theme.fontWeightNormal)};
  gap: ${space(1)};
  opacity: ${p => (p.isSelected ? 1 : 0.6)};
  transition: opacity 0.2s ease;

  & > div:first-of-type {
    flex: 1;
    min-width: 0;
    margin-right: ${space(1)};
  }

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const IconWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const SelectionButtonWrapper = styled('div')`
  position: absolute;
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  right: 0;
`;

const SelectionButton = styled('button')`
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${p => p.theme.gray300};
  opacity: 0;
  transition:
    opacity 0.2s ease,
    color 0.2s ease,
    background-color 0.2s ease;
  border-radius: 5px;
  padding: 4px;

  ${StyledTimelineHeader}:hover & {
    opacity: 1;
  }

  &:hover {
    color: ${p => p.theme.gray500};
    background-color: ${p => p.theme.background};
  }
`;

const StyledIconChevron = styled(IconChevron)`
  color: ${p => p.theme.gray300};
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 0.2s ease;
  margin-right: ${space(0.25)};

  ${StyledTimelineHeader}:hover & {
    opacity: 0;
  }
`;

const InstructionsInputWrapper = styled('div')`
  display: flex;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.backgroundSecondary};
  margin-top: ${space(0.5)};
`;

const InstructionsInput = styled('input')`
  flex-grow: 1;
  border: none;
  outline: none;
  padding: ${space(1)};
  line-height: 1.4;
  color: ${p => p.theme.gray500};
  background-color: transparent;

  &::placeholder {
    color: ${p => p.theme.gray300};
  }

  &:focus {
    outline: none;
    color: ${p => p.theme.textColor};
  }
`;

const AddStepButton = styled(Button)`
  margin: ${space(0.5)};
  min-width: 60px;
  border-radius: 5px;
`;

const AddInstructionWrapper = styled('div')`
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(4)};
`;

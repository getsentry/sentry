import {useRef, useState} from 'react';
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
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
} from 'sentry/components/events/autofix/useAutofix';
import {IconCheckmark, IconClose, IconEdit, IconFix} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked';
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
        | {
            mode: 'all' | 'fix' | 'test';
          }
        | {
            customSolution: string;
            mode: 'all' | 'fix' | 'test';
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
                  mode: params.mode,
                },
              }
            : {
                run_id: runId,
                payload: {
                  type: 'select_solution',
                  mode: params.mode,
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
}: {
  groupId: string;
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
        <AutofixTimeline events={solution} activeColor="green400" />
      </div>
    </SolutionDescriptionWrapper>
  );
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
}: Omit<AutofixSolutionProps, 'repos'>) {
  const {mutate: handleContinue, isPending} = useSelectSolution({groupId, runId});
  const [isEditing, setIsEditing] = useState(false);
  const [userCustomSolution, setUserCustomSolution] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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
              <IconFix size="sm" />
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
            <IconFix size="sm" />
            {t('Solution')}
          </HeaderText>
          <ButtonBar gap={1}>
            <ButtonBar>
              {!isEditing && (
                <CopySolutionButton solution={solution} isEditing={isEditing} />
              )}
              {!changesDisabled && (
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
                  if (isEditing) {
                    if (userCustomSolution.trim()) {
                      handleContinue({
                        customSolution: userCustomSolution.trim(),
                        mode: 'fix',
                      });
                    }
                  } else {
                    handleContinue({
                      mode: 'fix',
                    });
                  }
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
                    onAction: () => handleContinue({mode: 'fix'}),
                    leadingItems: <IconCheckmark size="sm" color="purple300" />,
                  },
                  {
                    key: 'test',
                    label: 'Write a reproduction test',
                    details:
                      'Autofix will write a unit test to reproduce the issue and validate future fixes.',
                    onAction: () => handleContinue({mode: 'test'}),
                    leadingItems: <div style={{width: 16}} />,
                  },
                  {
                    key: 'all',
                    label: 'Write both',
                    details:
                      'Autofix will implement this solution and a test to validate the issue is fixed.',
                    onAction: () => handleContinue({mode: 'all'}),
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
              description={description}
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

import {Fragment, useRef, useState} from 'react';
import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ClippedBox from 'sentry/components/clippedBox';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {
  type AutofixRepository,
  type AutofixRootCauseData,
  type AutofixRootCauseSelection,
  AutofixStatus,
  AutofixStepType,
  type CodeSnippetContext,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
} from 'sentry/components/events/autofix/useAutofix';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFileExtension} from 'sentry/utils/fileExtension';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {singleLineRenderer} from 'sentry/utils/marked';
import {getPrismLanguage} from 'sentry/utils/prism';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

import AutofixHighlightPopup from './autofixHighlightPopup';
import {AutofixTimeline} from './autofixTimeline';
import {useTextSelection} from './useTextSelection';

type AutofixRootCauseProps = {
  causes: AutofixRootCauseData[];
  groupId: string;
  repos: AutofixRepository[];
  rootCauseSelection: AutofixRootCauseSelection;
  runId: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  terminationReason?: string;
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

export function useSelectCause({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      params:
        | {
            causeId: string;
            instruction?: string;
          }
        | {
            customRootCause: string;
          }
    ) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data:
          'customRootCause' in params
            ? {
                run_id: runId,
                payload: {
                  type: 'select_root_cause',
                  custom_root_cause: params.customRootCause,
                },
              }
            : {
                run_id: runId,
                payload: {
                  type: 'select_root_cause',
                  cause_id: params.causeId,
                  instruction: params.instruction,
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
                if (step.type !== AutofixStepType.ROOT_CAUSE_ANALYSIS) {
                  return step;
                }

                return {
                  ...step,
                  selection:
                    'customRootCause' in params
                      ? {
                          custom_root_cause: params.customRootCause,
                        }
                      : {
                          cause_id: params.causeId,
                        },
                };
              }),
            },
          };
        }
      );
      addSuccessMessage("Great, let's move forward with this root cause.");
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when selecting the root cause.'));
    },
  });
}

export function replaceHeadersWithBold(markdown: string) {
  const headerRegex = /^(#{1,6})\s+(.*)$/gm;
  const boldMarkdown = markdown.replace(headerRegex, (_match, _hashes, content) => {
    return ` **${content}** `;
  });

  return boldMarkdown;
}

function RootCauseDescription({
  cause,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
}: {
  cause: AutofixRootCauseData;
  groupId: string;
  runId: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selection = useTextSelection(containerRef);

  return (
    <CauseDescription>
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
        {cause.description && (
          <p dangerouslySetInnerHTML={{__html: singleLineRenderer(cause.description)}} />
        )}
        {cause.root_cause_reproduction && (
          <AutofixTimeline events={cause.root_cause_reproduction} />
        )}
      </div>
    </CauseDescription>
  );
}

function formatRootCauseText(
  cause: AutofixRootCauseData | undefined,
  customRootCause?: string
) {
  if (!cause && !customRootCause) {
    return '';
  }

  if (customRootCause) {
    return customRootCause;
  }

  if (!cause) {
    return '';
  }

  const parts: string[] = [];

  if (cause.description) {
    parts.push(cause.description);
  }

  // Add timeline
  if (cause.root_cause_reproduction) {
    parts.push(cause.root_cause_reproduction.map(event => `- ${event.title}`).join('\n'));
  }

  return parts.join('');
}

function CopyRootCauseButton({
  cause,
  customRootCause,
  isEditing,
}: {
  cause?: AutofixRootCauseData;
  customRootCause?: string;
  isEditing?: boolean;
}) {
  if (isEditing) {
    return null;
  }
  const text = formatRootCauseText(cause, customRootCause);
  return <CopyToClipboardButton size="sm" text={text} />;
}

function AutofixRootCauseDisplay({
  causes,
  groupId,
  runId,
  rootCauseSelection,
  previousDefaultStepIndex,
  previousInsightCount,
}: AutofixRootCauseProps) {
  const {mutate: handleSelectFix, isPending} = useSelectCause({groupId, runId});
  const [isEditing, setIsEditing] = useState(false);
  const [customRootCause, setCustomRootCause] = useState('');
  const cause = causes[0];

  if (!cause) {
    return <Alert type="error">{t('No root cause available.')}</Alert>;
  }

  if (rootCauseSelection) {
    if ('custom_root_cause' in rootCauseSelection) {
      return (
        <CausesContainer>
          <CustomRootCausePadding>
            <HeaderWrapper>
              <HeaderText>
                <IconFocus size="sm" />
                {t('Custom Root Cause')}
              </HeaderText>
              <CopyRootCauseButton
                customRootCause={rootCauseSelection.custom_root_cause}
                isEditing={isEditing}
              />
            </HeaderWrapper>
            <CauseDescription>{rootCauseSelection.custom_root_cause}</CauseDescription>
          </CustomRootCausePadding>
        </CausesContainer>
      );
    }

    const selectedCause = causes.find(c => c.id === rootCauseSelection.cause_id);

    if (!selectedCause) {
      return <Alert type="error">{t('Selected root cause not found.')}</Alert>;
    }

    return (
      <CausesContainer>
        <ClippedBox clipHeight={408}>
          <HeaderWrapper>
            <HeaderText>
              <IconFocus size="sm" />
              {t('Root Cause')}
            </HeaderText>
            <CopyRootCauseButton cause={selectedCause} isEditing={isEditing} />
          </HeaderWrapper>
          <Content>
            <RootCauseDescription
              cause={selectedCause}
              groupId={groupId}
              runId={runId}
              previousDefaultStepIndex={previousDefaultStepIndex}
              previousInsightCount={previousInsightCount}
            />
          </Content>
        </ClippedBox>
      </CausesContainer>
    );
  }

  return (
    <PotentialCausesContainer>
      <ClippedBox clipHeight={408}>
        <HeaderWrapper>
          <HeaderText>
            <IconFocus size="sm" />
            {t('Root Cause')}
          </HeaderText>
          <ButtonBar gap={1}>
            <CopyRootCauseButton cause={cause} isEditing={isEditing} />
            <Button
              size="sm"
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false);
                  setCustomRootCause('');
                } else {
                  setIsEditing(true);
                }
              }}
            >
              {isEditing ? t('Cancel') : t('Edit')}
            </Button>
            <Button
              size="sm"
              priority="primary"
              onClick={() => {
                if (isEditing && customRootCause.trim()) {
                  handleSelectFix({customRootCause: customRootCause.trim()});
                } else if (!isEditing) {
                  handleSelectFix({causeId: cause.id});
                }
              }}
              busy={isPending}
            >
              {t('Find Fix')}
            </Button>
          </ButtonBar>
        </HeaderWrapper>
        <Content>
          {isEditing ? (
            <TextArea
              value={customRootCause}
              onChange={e => {
                setCustomRootCause(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={5}
              autoFocus
              placeholder={t('Propose your own root cause...')}
            />
          ) : (
            <Fragment>
              <RootCauseDescription
                cause={cause}
                groupId={groupId}
                runId={runId}
                previousDefaultStepIndex={previousDefaultStepIndex}
                previousInsightCount={previousInsightCount}
              />
            </Fragment>
          )}
        </Content>
      </ClippedBox>
    </PotentialCausesContainer>
  );
}

export function AutofixRootCause(props: AutofixRootCauseProps) {
  if (props.causes.length === 0) {
    return (
      <AnimatePresence initial>
        <AnimationWrapper key="card" {...cardAnimationProps}>
          <NoCausesPadding>
            <Alert type="warning">
              {t('No root cause found.\n\n%s', props.terminationReason ?? '')}
            </Alert>
          </NoCausesPadding>
        </AnimationWrapper>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <AutofixRootCauseDisplay {...props} />
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const NoCausesPadding = styled('div')`
  padding: 0 ${space(2)};
`;

const CausesContainer = styled('div')`
  border: 2px solid ${p => p.theme.alert.success.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding-left: ${space(2)};
  padding-right: ${space(2)};
  padding-top: ${space(1)};
`;

const PotentialCausesContainer = styled(CausesContainer)`
  border: 2px solid ${p => p.theme.alert.info.border};
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

const CustomRootCausePadding = styled('div')`
  padding: ${space(1)} ${space(0.25)} ${space(2)} ${space(0.25)};
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const StyledIconWrapper = styled('span')`
  color: inherit;
  line-height: 0;
`;

const LinkStyles = css`
  align-items: center;
  gap: ${space(0.75)};
`;

const OpenInLink = styled(ExternalLink)`
  ${LinkStyles}
  color: ${p => p.theme.subText};
  animation: ${fadeIn} 0.2s ease-in-out forwards;
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const CodeLinkWrapper = styled('div')`
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.family};
  padding: 0 ${space(1)};
  position: absolute;
  top: 8px;
  right: 0;
`;

const CodeSnippetWrapper = styled('div')`
  position: relative;
`;

const CauseDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-top: ${space(1)};
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  margin-top: ${space(2)};
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

export function SuggestedFixSnippet({
  snippet,
  linesToHighlight,
  repos,
  icon,
}: {
  linesToHighlight: number[];
  repos: AutofixRepository[];
  snippet: CodeSnippetContext;
  icon?: React.ReactNode;
}) {
  function getSourceLink() {
    if (!repos) {
      return null;
    }
    const repo = repos.find(
      r => r.name === snippet.repo_name && r.provider === 'integrations:github'
    );
    if (!repo) {
      return null;
    }
    return `${repo.url}/blob/${repo.default_branch}/${snippet.file_path}${
      snippet.start_line && snippet.end_line
        ? `#L${snippet.start_line}-L${snippet.end_line}`
        : ''
    }`;
  }
  const extension = getFileExtension(snippet.file_path);
  const language = extension ? getPrismLanguage(extension) : undefined;
  const sourceLink = getSourceLink();

  return (
    <CodeSnippetWrapper>
      <StyledCodeSnippet
        filename={snippet.file_path}
        language={language}
        hideCopyButton
        linesToHighlight={linesToHighlight}
        icon={icon}
      >
        {snippet.snippet}
      </StyledCodeSnippet>
      {sourceLink && (
        <CodeLinkWrapper>
          <Tooltip title={t('Open in GitHub')} skipWrapper>
            <OpenInLink href={sourceLink} openInNewTab aria-label={t('GitHub')}>
              <StyledIconWrapper>{getIntegrationIcon('github', 'sm')}</StyledIconWrapper>
            </OpenInLink>
          </Tooltip>
        </CodeLinkWrapper>
      )}
    </CodeSnippetWrapper>
  );
}

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

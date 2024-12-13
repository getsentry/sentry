import {Fragment, type ReactNode, useState} from 'react';
import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ClippedBox from 'sentry/components/clippedBox';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {ExpandableInsightContext} from 'sentry/components/events/autofix/autofixInsightCards';
import {AutofixShowMore} from 'sentry/components/events/autofix/autofixShowMore';
import {
  type AutofixRepository,
  type AutofixRootCauseCodeContext,
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
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCode, IconFocus, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFileExtension} from 'sentry/utils/fileExtension';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import {getPrismLanguage} from 'sentry/utils/prism';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

type AutofixRootCauseProps = {
  causes: AutofixRootCauseData[];
  groupId: string;
  repos: AutofixRepository[];
  rootCauseSelection: AutofixRootCauseSelection;
  runId: string;
  terminationReason?: string;
};

const contentAnimationProps: AnimationProps = {
  exit: {opacity: 0},
  initial: {opacity: 0},
  animate: {opacity: 1},
  transition: testableTransition({duration: 0.3}),
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

function getLinesToHighlight(suggestedFix: AutofixRootCauseCodeContext): number[] {
  function findLinesWithSubstrings(
    input: string | undefined,
    substring: string
  ): number[] {
    if (!input) {
      return [];
    }
    const lines = input.split('\n');
    const result: number[] = [];

    lines.forEach((line, index) => {
      if (line.includes(substring)) {
        result.push(index + 1); // line numbers are 1-based
      }
    });

    return result;
  }

  const lineNumbersToHighlight = findLinesWithSubstrings(
    suggestedFix.snippet?.snippet,
    '***'
  );
  return lineNumbersToHighlight;
}

export function replaceHeadersWithBold(markdown: string) {
  const headerRegex = /^(#{1,6})\s+(.*)$/gm;
  const boldMarkdown = markdown.replace(headerRegex, (_match, _hashes, content) => {
    return ` **${content}** `;
  });

  return boldMarkdown;
}

function RootCauseDescription({cause}: {cause: AutofixRootCauseData}) {
  return (
    <CauseDescription
      dangerouslySetInnerHTML={{
        __html: marked(replaceHeadersWithBold(cause.description)),
      }}
    />
  );
}

function RootCauseContext({
  cause,
  repos,
}: {
  cause: AutofixRootCauseData;
  repos: AutofixRepository[];
}) {
  const unitTestFileExtension = cause.unit_test?.file_path
    ? getFileExtension(cause.unit_test.file_path)
    : undefined;
  const unitTestLanguage = unitTestFileExtension
    ? getPrismLanguage(unitTestFileExtension)
    : undefined;

  return (
    <RootCauseContextContainer>
      {(cause.reproduction || cause.unit_test) && (
        <ExpandableInsightContext
          icon={<IconRefresh size="sm" color="subText" />}
          title={'How to reproduce'}
          rounded
        >
          {cause.reproduction && (
            <CauseDescription
              dangerouslySetInnerHTML={{
                __html: marked(replaceHeadersWithBold(cause.reproduction)),
              }}
            />
          )}
          {cause.unit_test && (
            <Fragment>
              <strong>{t('Unit test that reproduces this root cause:')}</strong>
              <CauseDescription
                dangerouslySetInnerHTML={{
                  __html: marked(replaceHeadersWithBold(cause.unit_test.description)),
                }}
              />
              <StyledCodeSnippet
                filename={cause.unit_test.file_path}
                language={unitTestLanguage}
              >
                {cause.unit_test.snippet}
              </StyledCodeSnippet>
            </Fragment>
          )}
        </ExpandableInsightContext>
      )}
      {cause?.code_context && cause.code_context.length > 0 && (
        <ExpandableInsightContext
          icon={<IconCode size="sm" color="subText" />}
          title={'Relevant code'}
          rounded
          expandByDefault
        >
          <AutofixRootCauseCodeContexts codeContext={cause.code_context} repos={repos} />
        </ExpandableInsightContext>
      )}
    </RootCauseContextContainer>
  );
}

function RootCauseContent({
  selected,
  children,
}: {
  children: ReactNode;
  selected: boolean;
}) {
  return (
    <ContentWrapper selected={selected}>
      <AnimatePresence initial={false}>
        {selected && (
          <AnimationWrapper key="content" {...contentAnimationProps}>
            {children}
          </AnimationWrapper>
        )}
      </AnimatePresence>
    </ContentWrapper>
  );
}

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
      return undefined;
    }
    const repo = repos.find(
      r => r.name === snippet.repo_name && r.provider === 'integrations:github'
    );
    if (!repo) {
      return undefined;
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

function CauseOption({
  cause,
  selected,
  setSelectedId,
  repos,
}: {
  cause: AutofixRootCauseData;
  groupId: string;
  repos: AutofixRepository[];
  runId: string;
  selected: boolean;
  setSelectedId: (id: string) => void;
}) {
  return (
    <RootCauseOption selected={selected} onClick={() => setSelectedId(cause.id)}>
      {!selected && <InteractionStateLayer />}
      <RootCauseOptionHeader>
        <TitleWrapper>
          <IconFocus size="sm" />
          <Title>{t('Potential Root Cause')}</Title>
        </TitleWrapper>
      </RootCauseOptionHeader>
      <RootCauseContent selected={selected}>
        <CauseTitle
          dangerouslySetInnerHTML={{
            __html: singleLineRenderer(cause.title),
          }}
        />
        <RootCauseDescription cause={cause} />
        <RootCauseContext cause={cause} repos={repos} />
      </RootCauseContent>
    </RootCauseOption>
  );
}

function SelectedRootCauseOption({
  selectedCause,
  repos,
}: {
  codeContext: AutofixRootCauseCodeContext[];
  repos: AutofixRepository[];
  selectedCause: AutofixRootCauseData;
}) {
  return (
    <RootCauseOption selected>
      <RootCauseOptionHeader>
        <TitleWrapper>
          <IconFocus size="sm" />
          <HeaderText>{t('Root Cause')}</HeaderText>
        </TitleWrapper>
      </RootCauseOptionHeader>
      <CauseTitle
        dangerouslySetInnerHTML={{
          __html: singleLineRenderer(selectedCause.title),
        }}
      />
      <RootCauseDescription cause={selectedCause} />
      <RootCauseContext cause={selectedCause} repos={repos} />
    </RootCauseOption>
  );
}

function AutofixRootCauseDisplay({
  causes,
  groupId,
  runId,
  rootCauseSelection,
  repos,
}: AutofixRootCauseProps) {
  const [selectedId, setSelectedId] = useState(() => causes[0].id);
  const {isPending, mutate: handleSelectFix} = useSelectCause({groupId, runId});

  if (rootCauseSelection) {
    if ('custom_root_cause' in rootCauseSelection) {
      return (
        <CausesContainer>
          <CustomRootCausePadding>
            <HeaderText>{t('Custom Root Cause')}</HeaderText>
            <CauseDescription>{rootCauseSelection.custom_root_cause}</CauseDescription>
          </CustomRootCausePadding>
        </CausesContainer>
      );
    }

    const selectedCause = causes.find(cause => cause.id === rootCauseSelection.cause_id);

    if (!selectedCause) {
      return <Alert type="error">{t('Selected root cause not found.')}</Alert>;
    }

    const otherCauses = causes.filter(cause => cause.id !== selectedCause.id);

    return (
      <CausesContainer>
        <ClippedBox clipHeight={408}>
          <SelectedRootCauseOption
            codeContext={selectedCause?.code_context}
            selectedCause={selectedCause}
            repos={repos}
          />
          {otherCauses.length > 0 && (
            <AutofixShowMore title={t('Show unselected causes')}>
              {otherCauses.map(cause => (
                <RootCauseOption selected key={cause.id}>
                  <RootCauseOptionHeader>
                    <Title
                      dangerouslySetInnerHTML={{
                        __html: singleLineRenderer(t('Cause: %s', cause.title)),
                      }}
                    />
                    <Button
                      size="xs"
                      onClick={() => handleSelectFix({causeId: cause.id})}
                      busy={isPending}
                      analyticsEventName="Autofix: Root Cause Fix Re-Selected"
                      analyticsEventKey="autofix.root_cause_fix_selected"
                      analyticsParams={{group_id: groupId}}
                    >
                      {t('Fix This Instead')}
                    </Button>
                  </RootCauseOptionHeader>
                  <RootCauseDescription cause={cause} />
                  <RootCauseContext cause={cause} repos={repos} />
                </RootCauseOption>
              ))}
            </AutofixShowMore>
          )}
        </ClippedBox>
      </CausesContainer>
    );
  }

  return (
    <PotentialCausesContainer>
      <ClippedBox clipHeight={408}>
        <OptionsPadding>
          {causes.map(cause => (
            <CauseOption
              key={cause.id}
              cause={cause}
              selected={cause.id === selectedId}
              setSelectedId={setSelectedId}
              runId={runId}
              groupId={groupId}
              repos={repos}
            />
          ))}
        </OptionsPadding>
      </ClippedBox>
    </PotentialCausesContainer>
  );
}

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

export function AutofixRootCauseCodeContexts({
  codeContext,
  repos,
}: {
  codeContext: AutofixRootCauseCodeContext[];
  repos: AutofixRepository[];
}) {
  return codeContext?.map((fix, index) => (
    <SuggestedFixWrapper key={fix.id}>
      <SuggestedFixHeader>
        <strong
          dangerouslySetInnerHTML={{
            __html: singleLineRenderer(t('Snippet #%s: %s', index + 1, fix.title)),
          }}
        />
      </SuggestedFixHeader>
      <p
        dangerouslySetInnerHTML={{
          __html: marked(fix.description),
        }}
      />
      {fix.snippet && (
        <SuggestedFixSnippet
          snippet={fix.snippet}
          linesToHighlight={getLinesToHighlight(fix)}
          repos={repos}
        />
      )}
    </SuggestedFixWrapper>
  ));
}

const NoCausesPadding = styled('div')`
  padding: 0 ${space(2)};
`;

const CausesContainer = styled('div')`
  border: 2px solid ${p => p.theme.alert.success.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const PotentialCausesContainer = styled(CausesContainer)`
  border: 2px solid ${p => p.theme.alert.info.border};
`;

const OptionsPadding = styled('div')`
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  padding-top: ${space(1)};
`;

const RootCauseOption = styled('div')<{selected: boolean}>`
  background: ${p => (p.selected ? p.theme.background : p.theme.backgroundElevated)};
  cursor: ${p => (p.selected ? 'default' : 'pointer')};
  padding-top: ${space(1)};
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const RootCauseContextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const RootCauseOptionHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
`;

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const CauseTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

const CauseDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-top: ${space(1)};
`;

const SuggestedFixWrapper = styled('div')`
  margin-top: ${space(1)};
  margin-bottom: ${space(4)};
  p {
    margin: ${space(1)} 0 0 0;
  }
`;

const SuggestedFixHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  margin-top: ${space(2)};
`;

const ContentWrapper = styled(motion.div)<{selected: boolean}>`
  display: grid;
  grid-template-rows: ${p => (p.selected ? '1fr' : '0fr')};
  transition: grid-template-rows 300ms;
  will-change: grid-template-rows;

  > div {
    /* So that focused element outlines don't get cut off */
    padding: 0 1px;
    overflow: hidden;
  }
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

const CustomRootCausePadding = styled('div')`
  padding: ${space(2)} ${space(2)} ${space(2)} ${space(2)};
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

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
`;

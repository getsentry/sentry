import React, {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import ClippedBox from 'sentry/components/clippedBox';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {
  type AutofixRootCauseData,
  type AutofixRootCauseSelection,
  type CommentThread,
} from 'sentry/components/events/autofix/types';
import {IconChat, IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import testableTransition from 'sentry/utils/testableTransition';

import AutofixHighlightPopup from './autofixHighlightPopup';
import {AutofixTimeline} from './autofixTimeline';

type AutofixRootCauseProps = {
  causes: AutofixRootCauseData[];
  groupId: string;
  rootCauseSelection: AutofixRootCauseSelection;
  runId: string;
  agentCommentThread?: CommentThread;
  isRootCauseFirstAppearance?: boolean;
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
  ref,
}: {
  cause: AutofixRootCauseData;
  groupId: string;
  runId: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <CauseDescription>
      {cause.description && (
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
            dangerouslySetInnerHTML={{__html: singleLineRenderer(cause.description)}}
          />
        </AutofixHighlightWrapper>
      )}
      {cause.root_cause_reproduction && (
        <AutofixTimeline
          events={cause.root_cause_reproduction}
          eventCodeUrls={cause.reproduction_urls}
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
    </CauseDescription>
  );
}

export function formatRootCauseText(
  cause: AutofixRootCauseData | undefined,
  customRootCause?: string
) {
  if (!cause && !customRootCause) {
    return '';
  }

  if (customRootCause) {
    return `# Root Cause of the Issue\n\n${customRootCause}`;
  }

  if (!cause) {
    return '';
  }

  const parts: string[] = ['# Root Cause of the Issue'];

  if (cause.description) {
    parts.push(cause.description);
  }

  if (cause.root_cause_reproduction) {
    parts.push(
      cause.root_cause_reproduction
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
  }

  return parts.join('\n\n');
}

function CopyRootCauseButton({
  cause,
  customRootCause,
}: {
  cause?: AutofixRootCauseData;
  customRootCause?: string;
}) {
  const text = formatRootCauseText(cause, customRootCause);
  return (
    <CopyToClipboardButton
      size="sm"
      text={text}
      borderless
      title="Copy root cause as Markdown"
      analyticsEventName="Autofix: Copy Root Cause as Markdown"
      analyticsEventKey="autofix.root_cause.copy"
    />
  );
}

function AutofixRootCauseDisplay({
  causes,
  groupId,
  runId,
  rootCauseSelection,
  previousDefaultStepIndex,
  previousInsightCount,
  agentCommentThread,
}: AutofixRootCauseProps) {
  const cause = causes[0];
  const iconFocusRef = useRef<HTMLDivElement>(null);
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

  if (!cause) {
    return (
      <Alert.Container>
        <Alert type="error">{t('No root cause available.')}</Alert>
      </Alert.Container>
    );
  }

  if (rootCauseSelection && 'custom_root_cause' in rootCauseSelection) {
    return (
      <CausesContainer>
        <CustomRootCausePadding>
          <HeaderWrapper>
            <HeaderText>
              <IconWrapper ref={iconFocusRef}>
                <IconFocus size="sm" color="pink400" />
              </IconWrapper>
              {t('Custom Root Cause')}
            </HeaderText>
            <CopyRootCauseButton customRootCause={rootCauseSelection.custom_root_cause} />
          </HeaderWrapper>
          <CauseDescription>{rootCauseSelection.custom_root_cause}</CauseDescription>
        </CustomRootCausePadding>
      </CausesContainer>
    );
  }

  return (
    <CausesContainer>
      <ClippedBox clipHeight={408}>
        <HeaderWrapper>
          <HeaderText>
            <IconWrapper ref={iconFocusRef}>
              <IconFocus size="sm" color="pink400" />
            </IconWrapper>
            {t('Root Cause')}
            <ChatButton
              size="zero"
              borderless
              title={t('Chat with Seer')}
              onClick={handleSelectDescription}
              analyticsEventName="Autofix: Root Cause Chat"
              analyticsEventKey="autofix.root_cause.chat"
            >
              <IconChat size="xs" />
            </ChatButton>
          </HeaderText>
          <ButtonBar gap="none">
            <CopyRootCauseButton cause={cause} />
          </ButtonBar>
        </HeaderWrapper>
        <AnimatePresence>
          {agentCommentThread && iconFocusRef.current && (
            <AutofixHighlightPopup
              selectedText=""
              referenceElement={iconFocusRef.current}
              groupId={groupId}
              runId={runId}
              stepIndex={previousDefaultStepIndex ?? 0}
              retainInsightCardIndex={
                previousInsightCount !== undefined && previousInsightCount >= 0
                  ? previousInsightCount
                  : null
              }
              isAgentComment
              blockName={t('Seer is uncertain of the root cause...')}
            />
          )}
        </AnimatePresence>
        <Content>
          <Fragment>
            <RootCauseDescription
              cause={cause}
              groupId={groupId}
              runId={runId}
              previousDefaultStepIndex={previousDefaultStepIndex}
              previousInsightCount={previousInsightCount}
              ref={descriptionRef}
            />
          </Fragment>
        </Content>
      </ClippedBox>
    </CausesContainer>
  );
}

export function AutofixRootCause(props: AutofixRootCauseProps) {
  if (props.causes.length === 0) {
    return (
      <AnimatePresence initial={props.isRootCauseFirstAppearance}>
        <AnimationWrapper key="card" {...cardAnimationProps}>
          <NoCausesPadding>
            <Alert.Container>
              <Alert type="warning">
                {t('No root cause found.\n\n%s', props.terminationReason ?? '')}
              </Alert>
            </Alert.Container>
          </NoCausesPadding>
        </AnimationWrapper>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={props.isRootCauseFirstAppearance}>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <AutofixRootCauseDisplay {...props} />
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const Description = styled('div')`
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding-bottom: ${space(2)};
  margin-bottom: ${space(2)};
`;

const NoCausesPadding = styled('div')`
  padding: 0 ${space(2)};
`;

const CausesContainer = styled('div')`
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
  gap: ${space(1)};
  flex-wrap: wrap;
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CustomRootCausePadding = styled('div')`
  padding: ${space(1)} ${space(0.25)} ${space(2)} ${space(0.25)};
`;

const CauseDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  margin-top: ${space(0.5)};
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

const ChatButton = styled(Button)`
  color: ${p => p.theme.subText};
  margin-left: -${space(0.5)};
`;

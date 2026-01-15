import React, {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {TextArea} from 'sentry/components/core/textarea';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import {useUpdateInsightCard} from 'sentry/components/events/autofix/hooks/useUpdateInsightCard';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {useTypingAnimation} from 'sentry/components/events/autofix/useTypingAnimation';
import {IconChevron, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import testableTransition from 'sentry/utils/testableTransition';

interface AutofixInsightCardProps {
  groupId: string;
  index: number;
  insight: AutofixInsight;
  isExpanded: boolean;
  isNewInsight: boolean | undefined;
  onToggleExpand: (index: number | null) => void;
  runId: string;
  stepIndex: number;
}

export const cardAnimationProps = {
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

export function FlippedReturnIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
  return <CheckpointIcon {...props}>{'\u21A9'}</CheckpointIcon>;
}

export function AutofixInsightCard({
  insight,
  index,
  stepIndex,
  groupId,
  runId,
  isNewInsight,
  isExpanded,
  onToggleExpand,
}: AutofixInsightCardProps) {
  const isUserMessage = insight.justification === 'USER';
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});
  const displayedInsightTitle = useTypingAnimation({
    text: insight.insight,
    enabled: !!isNewInsight,
    speed: 70,
  });

  const toggleExpand = () => {
    onToggleExpand(index);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditText('');
    onToggleExpand(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    updateInsight({
      message: editText,
      step_index: stepIndex,
      retain_insight_card_index: index,
    });
  };

  const insightCardAboveIndex = index - 1 >= 0 ? index - 1 : null;

  const newlineIndex = displayedInsightTitle.indexOf('\n');

  const truncatedTitleHtml = useMemo(() => {
    let truncatedTitle = displayedInsightTitle;
    if (newlineIndex !== -1 && newlineIndex < displayedInsightTitle.length - 1) {
      truncatedTitle = ellipsize(truncatedTitle, newlineIndex);
    }
    return {
      __html: singleLineRenderer(truncatedTitle),
    };
  }, [displayedInsightTitle, newlineIndex]);

  const hasFullJustification = !isUserMessage && insight.justification;

  const fullJustificationText = useMemo(() => {
    let fullJustification = isUserMessage ? '' : insight.justification;
    if (newlineIndex !== -1) {
      const excludedText = displayedInsightTitle.substring(newlineIndex + 1);
      const excludedTextWithEllipsis = excludedText ? '...' + excludedText : '';
      fullJustification = excludedTextWithEllipsis + '\n\n' + fullJustification;
    }
    return replaceHeadersWithBold(fullJustification || t('No details here.'));
  }, [displayedInsightTitle, isUserMessage, insight.justification, newlineIndex]);

  // Determine if the card is expandable (not just 'No details here.')
  const isExpandable = useMemo(() => {
    // Remove markdown formatting and whitespace for the check
    const plainText = (hasFullJustification ? insight.justification : '').trim();
    // If there is a diff or markdown_snippets, allow expansion
    if (insight.change_diff || insight.markdown_snippets) return true;
    // If the justification is empty or just 'No details here.', not expandable
    return !!plainText && plainText.toLowerCase() !== t('No details here.').toLowerCase();
  }, [
    hasFullJustification,
    insight.justification,
    insight.change_diff,
    insight.markdown_snippets,
  ]);

  const renderCardContent = () => (
    <React.Fragment>
      {isEditing ? (
        <EditContainer>
          <form onSubmit={handleSubmit}>
            <EditFormRow>
              <EditInput
                autosize
                value={editText}
                maxLength={4096}
                onChange={e => setEditText(e.target.value)}
                placeholder={t('Share your own insight here...')}
                autoFocus
                maxRows={5}
                size="sm"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  } else if (e.key === 'Escape') {
                    handleCancel();
                  }
                }}
              />
              <ButtonBar merged gap="0">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCancel}
                  title={t('Cancel')}
                  aria-label={t('Cancel')}
                >
                  <IconClose size="sm" />
                </Button>
                <Button
                  type="submit"
                  priority="primary"
                  size="sm"
                  title={t('Redo work from here')}
                  aria-label={t('Redo work from here')}
                  analyticsEventName="Autofix: Insight Card Rethink Open"
                  analyticsEventKey="autofix.insight.rethink_open"
                  analyticsParams={{
                    insight_card_index: index,
                    step_index: stepIndex,
                    group_id: groupId,
                    run_id: runId,
                  }}
                >
                  {'\u23CE'}
                </Button>
              </ButtonBar>
            </EditFormRow>
          </form>
        </EditContainer>
      ) : (
        <InsightCardRow
          onClick={isExpandable ? toggleExpand : undefined}
          expanded={isExpanded}
          style={isExpandable ? {} : {cursor: 'default', background: 'none'}}
        >
          <AutofixHighlightWrapper
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={insightCardAboveIndex}
          >
            <MiniHeader
              dangerouslySetInnerHTML={truncatedTitleHtml}
              expanded={isExpanded}
            />
          </AutofixHighlightWrapper>

          <RightSection>
            {isExpandable && (
              <Button
                size="zero"
                borderless
                title={isExpanded ? t('Hide evidence') : t('Show evidence')}
                icon={
                  <StyledIconChevron direction={isExpanded ? 'up' : 'down'} size="xs" />
                }
                aria-label={isExpanded ? t('Hide evidence') : t('Show evidence')}
              />
            )}
            <EditButton
              size="zero"
              borderless
              onClick={handleEdit}
              icon={<FlippedReturnIcon />}
              aria-label={t('Edit insight')}
              title={t('Rethink the answer from here')}
              analyticsEventName="Autofix: Insight Card Rethink"
              analyticsEventKey="autofix.insight.rethink"
              analyticsParams={{
                insight_card_index: index,
                step_index: stepIndex,
                group_id: groupId,
                run_id: runId,
              }}
            />
          </RightSection>
        </InsightCardRow>
      )}

      <AnimatePresence>
        {isExpanded && isExpandable && (
          <motion.div
            initial={{height: 0, opacity: 0}}
            animate={{height: 'auto', opacity: 1}}
            exit={{height: 0, opacity: 0}}
            transition={{
              type: 'spring',
              duration: 0.4,
              bounce: 0.1,
            }}
          >
            <ContextBody>
              <AutofixHighlightWrapper
                groupId={groupId}
                runId={runId}
                stepIndex={stepIndex}
                retainInsightCardIndex={insightCardAboveIndex}
              >
                {hasFullJustification || !insight.change_diff ? (
                  <Fragment>
                    <ContextMarkedText as="p" text={fullJustificationText} />
                    {insight.markdown_snippets && (
                      <ContextMarkedText as="p" text={insight.markdown_snippets} />
                    )}
                  </Fragment>
                ) : (
                  <DiffContainer>
                    <AutofixDiff
                      diff={insight.change_diff}
                      groupId={groupId}
                      runId={runId}
                      editable={false}
                      integratedStyle
                    />
                  </DiffContainer>
                )}
              </AutofixHighlightWrapper>
            </ContextBody>
          </motion.div>
        )}
      </AnimatePresence>
    </React.Fragment>
  );

  return (
    <AnimatePresence initial={!!isNewInsight}>
      {isNewInsight ? (
        <motion.div key={`insight-${index}`} {...cardAnimationProps}>
          <InsightContainer expanded={isExpanded}>{renderCardContent()}</InsightContainer>
        </motion.div>
      ) : (
        <InsightContainer expanded={isExpanded}>{renderCardContent()}</InsightContainer>
      )}
    </AnimatePresence>
  );
}

// Styled Components
const InsightCardRow = styled('div')<{expanded?: boolean; isUserMessage?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  cursor: pointer;

  &:hover {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const ContextMarkedText = styled(MarkedText)`
  font-size: ${p => p.theme.fontSize.sm};
  code {
    font-size: ${p => p.theme.fontSize.sm};
  }
`;

const InsightContainer = styled('div')<{expanded?: boolean}>`
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  margin-bottom: 0;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-color: ${p => (p.expanded ? p.theme.tokens.border.primary : 'transparent')};

  box-shadow: ${p => (p.expanded ? p.theme.dropShadowMedium : 'none')};
`;

const MiniHeader = styled('p')<{expanded?: boolean}>`
  padding-top: ${space(0.25)};
  padding-bottom: ${space(0.25)};
  padding-left: ${space(1)};
  padding-right: ${space(2)};
  margin: 0;
  flex: 1;
  word-break: break-word;
  color: ${p =>
    p.expanded ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};

  code {
    color: ${p =>
      p.expanded ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};
  }
`;

const ContextBody = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  background: ${p => p.theme.alert.info.backgroundLight};
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  overflow: hidden;
  position: relative;
  border-top: 1px dashed ${p => p.theme.tokens.border.secondary};

  code {
    white-space: pre-wrap;
    word-break: break-word;
    background-color: transparent;
  }
`;

const StyledIconChevron = styled(IconChevron)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const RightSection = styled('div')`
  display: flex;
  align-items: center;
  padding-right: ${space(0.5)};
`;

const EditContainer = styled('div')`
  padding: ${space(1)};
  width: 100%;
`;

const EditFormRow = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  width: 100%;
`;

const EditInput = styled(TextArea)`
  flex: 1;
  resize: none;
`;

const EditButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const DiffContainer = styled('div')`
  margin-left: -${space(2)};
  margin-right: -${space(2)};
  margin-top: -${space(2)};
`;

const CheckpointIcon = styled('span')`
  transform: scaleY(-1);
  margin-bottom: ${space(0.5)};
`;

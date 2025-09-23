import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {closeModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {TextArea} from 'sentry/components/core/textarea';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {useUpdateInsightCard} from 'sentry/components/events/autofix/autofixInsightCards';
import AutofixInsightSources from 'sentry/components/events/autofix/autofixInsightSources';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MarkedText} from 'sentry/utils/marked/markedText';

export interface ModalWithFeedbackProps {
  Body: React.ComponentType<any>;
  CloseButton: React.ComponentType<any>;
  Footer: React.ComponentType<any>;
  Header: React.ComponentType<any>;
  fullJustificationText: string;
  groupId: string;
  hasFullJustification: boolean;
  insight: AutofixInsight;
  insightCardAboveIndex: number | null;
  runId: string;
  stepIndex: number;
  titleHtml: {__html: string};
}

export function ModalWithFeedback({
  insight,
  groupId,
  runId,
  stepIndex,
  insightCardAboveIndex,
  titleHtml,
  hasFullJustification,
  fullJustificationText,
  Header,
  Body,
  Footer,
  CloseButton,
}: ModalWithFeedbackProps) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const updateInsightCard = useUpdateInsightCard({groupId, runId});

  // Handle escape key to prevent bubbling to parent drawer
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        closeModal();
      }
    };

    // Add event listener with capture to handle before modal's built-in handler
    document.addEventListener('keydown', handleEscapeKey, {capture: true});

    return () => {
      document.removeEventListener('keydown', handleEscapeKey, {capture: true});
    };
  }, []);

  const handleSubmitFeedback = () => {
    if (feedbackMessage.trim()) {
      updateInsightCard.mutate({
        message: feedbackMessage,
        retain_insight_card_index: (insightCardAboveIndex ?? 0) + 1,
        step_index: stepIndex,
      });
      setShowFeedbackForm(false);
      setFeedbackMessage('');
      closeModal();
    }
  };

  const handleCancelFeedback = () => {
    setShowFeedbackForm(false);
    setFeedbackMessage('');
  };

  return (
    <Fragment>
      <Header>
        <ModalHeaderContent>
          <ModalTitle dangerouslySetInnerHTML={titleHtml} />
          <CloseButton />
        </ModalHeaderContent>
      </Header>
      <Body>
        <AutofixHighlightWrapper
          groupId={groupId}
          runId={runId}
          stepIndex={stepIndex}
          retainInsightCardIndex={insightCardAboveIndex}
        >
          {hasFullJustification || !insight.change_diff ? (
            <Fragment>
              <ContextMarkedText text={fullJustificationText} />
              {insight.markdown_snippets && (
                <ContextMarkedText text={insight.markdown_snippets} />
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
      </Body>
      <Footer>
        {showFeedbackForm ? (
          <FeedbackForm>
            <StyledTextArea
              value={feedbackMessage}
              onChange={e => setFeedbackMessage(e.target.value)}
              placeholder={t('Share your insight and Seer will re-analyze from here...')}
              autoFocus
              autosize
              size="sm"
              maxRows={4}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitFeedback();
                }
              }}
            />
            <FeedbackFormButtons>
              <Button size="sm" onClick={handleCancelFeedback}>
                {t('Cancel')}
              </Button>
              <Button
                size="sm"
                priority="primary"
                onClick={handleSubmitFeedback}
                disabled={!feedbackMessage.trim()}
                aria-label={t('Submit feedback')}
              >
                {t('Submit')}
              </Button>
            </FeedbackFormButtons>
          </FeedbackForm>
        ) : (
          <FooterContent>
            {insight.sources && (
              <AutofixInsightSources
                sources={insight.sources}
                title={insight.insight}
                size="md"
                alignment="left"
              />
            )}
            <FeedbackButtonContainer>
              <Button
                size="md"
                priority="primary"
                icon={<IconRefresh />}
                onClick={() => setShowFeedbackForm(true)}
              >
                {t("This isn't right, let's rethink")}
              </Button>
            </FeedbackButtonContainer>
          </FooterContent>
        )}
      </Footer>
    </Fragment>
  );
}

const ModalHeaderContent = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space(2)};
  width: 100%;
`;

const ModalTitle = styled('h2')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
  word-break: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  flex: 1;

  code {
    background: transparent;
    border-radius: ${p => p.theme.borderRadius};
  }
`;

const ContextMarkedText = styled(MarkedText)`
  font-size: ${p => p.theme.fontSize.md};
  margin: 0;

  code {
    font-size: ${p => p.theme.fontSize.sm};
    background: transparent;
    border-radius: 2px;
  }
`;

const DiffContainer = styled('div')`
  margin: -${space(1)} -${space(2)} 0;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const FooterContent = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space['3xl']};
  align-items: center;
  width: 100%;
`;

const FeedbackButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

const FeedbackForm = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  width: 100%;
`;

const FeedbackFormButtons = styled('div')`
  display: flex;
  gap: ${space(1)};
  justify-content: flex-end;
  align-items: center;
`;

const StyledTextArea = styled(TextArea)`
  resize: none;
  width: 100%;
  border-color: ${p => p.theme.innerBorder};
  &:hover {
    border-color: ${p => p.theme.border};
  }
`;

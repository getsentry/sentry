import React, {useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {TextArea} from 'sentry/components/core/textarea';
import {useUpdateInsightCard} from 'sentry/components/events/autofix/hooks/useUpdateInsightCard';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {FlippedReturnIcon} from './autofixInsightCard';

interface CollapsibleChainLinkProps {
  groupId: string;
  runId: string;
  stepIndex: number;
  insightCount?: number;
  isCollapsed?: boolean;
  isEmpty?: boolean;
  showAddControl?: boolean;
}

export function CollapsibleChainLink({
  insightCount,
  isCollapsed,
  isEmpty,
  showAddControl,
  stepIndex,
  groupId,
  runId,
}: CollapsibleChainLinkProps) {
  // Only show the rethink button if there are no insights
  const shouldShowRethinkButton =
    showAddControl && !isCollapsed && !isEmpty && insightCount === 0;

  const [isAdding, setIsAdding] = useState(false);
  const [newInsightText, setNewInsightText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});

  const organization = useOrganization();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(false);
    updateInsight({
      message: newInsightText,
      step_index: stepIndex,
      retain_insight_card_index:
        insightCount !== undefined && insightCount > 0 ? insightCount : null,
    });
    setNewInsightText('');

    trackAnalytics('autofix.step.rethink', {
      step_index: stepIndex,
      group_id: groupId,
      run_id: runId,
      organization,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewInsightText('');
  };

  return (
    <VerticalLineContainer isEmpty={isEmpty}>
      <RethinkButtonContainer className="rethink-button-container">
        {shouldShowRethinkButton &&
          (isAdding ? (
            <AddEditContainer>
              <form onSubmit={handleSubmit}>
                <Flex align="center" gap="md" width="100%">
                  <EditInput
                    type="text"
                    value={newInsightText}
                    onChange={e => setNewInsightText(e.target.value)}
                    maxLength={4096}
                    placeholder={t('Share your own insight here...')}
                    autoFocus
                    autosize
                    size="sm"
                    maxRows={5}
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
                    >
                      <IconClose size="sm" />
                    </Button>
                    <Button
                      type="submit"
                      priority="primary"
                      size="sm"
                      title={t('Redo work from here')}
                      aria-label={t('Redo work from here')}
                    >
                      {'\u23CE'}
                    </Button>
                  </ButtonBar>
                </Flex>
              </form>
            </AddEditContainer>
          ) : (
            <AddButton
              size="zero"
              borderless
              onClick={() => setIsAdding(true)}
              title={t('Give feedback and rethink the answer')}
              aria-label={t('Give feedback and rethink the answer')}
              analyticsEventName="Autofix: Step Rethink Open"
              analyticsEventKey="autofix.step.rethink_open"
              analyticsParams={{
                step_index: stepIndex,
                group_id: groupId,
                run_id: runId,
              }}
            >
              <RethinkLabel>{t('Rethink this answer')}</RethinkLabel>
              <FlippedReturnIcon />
            </AddButton>
          ))}
      </RethinkButtonContainer>
    </VerticalLineContainer>
  );
}

// Styled Components
const VerticalLineContainer = styled('div')<{
  isEmpty?: boolean;
}>`
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  padding: 0;
  min-height: ${p => (p.isEmpty ? space(4) : 'auto')};
`;

const RethinkButtonContainer = styled('div')`
  position: relative;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
  background: ${p => p.theme.tokens.background.primary};
  border-radius: 0;
  padding: 0;
  z-index: 1;
`;

const AddEditContainer = styled('div')`
  padding: ${space(1)};
  width: 100%;
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const EditInput = styled(TextArea)`
  flex: 1;
  resize: none;
`;

const AddButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const RethinkLabel = styled('span')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  margin-right: ${space(0.5)};
`;

import {useMemo, useState} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Tooltip} from 'sentry/components/core/tooltip';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {type AutofixSolutionTimelineEvent} from 'sentry/components/events/autofix/types';
import {Timeline, type TimelineItemProps} from 'sentry/components/timeline';
import {
  IconAdd,
  IconChevron,
  IconClose,
  IconCode,
  IconDelete,
  IconLab,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

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
    case 'repro_test':
      return <IconLab {...iconProps} />;
    default:
      return <IconCode {...iconProps} />;
  }
}

function getEventColor(
  theme: Theme,
  isActive?: boolean,
  isSelected?: boolean
): TimelineItemProps['colorConfig'] {
  if (isChonkTheme(theme)) {
    return {
      title: theme.colors.content.primary,
      icon: isSelected
        ? isActive
          ? theme.green400
          : theme.colors.content.primary
        : theme.colors.content.muted,
      iconBorder: isSelected
        ? isActive
          ? theme.green400
          : theme.colors.content.primary
        : theme.colors.content.muted,
    };
  }
  return {
    title: theme.gray400,
    icon: isSelected ? (isActive ? theme.green400 : theme.gray400) : theme.gray200,
    iconBorder: isSelected ? (isActive ? theme.green400 : theme.gray400) : theme.gray200,
  };
}

interface SolutionEventItemProps {
  event: AutofixSolutionTimelineEvent;
  groupId: string;
  index: number;
  isSelected: boolean;
  onDeleteItem: (index: number) => void;
  onToggleActive: (index: number) => void;
  runId: string;
  stepIndex: number;
  retainInsightCardIndex?: number | null;
}

export function SolutionEventItem({
  event,
  groupId,
  index,
  isSelected,
  onDeleteItem,
  onToggleActive,
  runId,
  retainInsightCardIndex,
  stepIndex,
}: SolutionEventItemProps) {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const isHumanAction = event.timeline_item_type === 'human_instruction';
  // XXX: This logic assumes the list length is available, which it isn't here.
  // We might need to pass list length or derive this differently if needed.
  // For now, approximating based on index 0 not being the last.
  const isActive = event.is_most_important_event && index !== 0;

  const titleHtml = useMemo(() => {
    return {__html: singleLineRenderer(event.title)};
  }, [event.title]);

  const analysisHtml = useMemo(() => {
    if (!event.code_snippet_and_analysis) {
      return undefined;
    }
    return {__html: singleLineRenderer(event.code_snippet_and_analysis)};
  }, [event.code_snippet_and_analysis]);

  const handleToggleExpand = () => {
    setIsExpanded(e => !e);
  };

  const handleItemClick = () => {
    if (!isSelected) {
      // If item is disabled, re-enable it instead of toggling expansion
      onToggleActive(index);
      return;
    }
    if (!isHumanAction && event.code_snippet_and_analysis) {
      handleToggleExpand();
    }
  };

  const handleSelectionToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggleActive(index);
    if (isSelected) {
      setIsExpanded(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDeleteItem(index);
  };

  return (
    <Timeline.Item
      title={
        <StyledTimelineHeader
          onClick={handleItemClick}
          isActive={isActive}
          isSelected={isSelected}
          data-test-id={`autofix-solution-timeline-item-${index}`}
        >
          <AutofixHighlightWrapper
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={retainInsightCardIndex}
          >
            <div dangerouslySetInnerHTML={titleHtml} />
          </AutofixHighlightWrapper>
          <IconWrapper>
            {!isHumanAction && event.code_snippet_and_analysis && isSelected && (
              <StyledIconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />
            )}
            <SelectionButtonWrapper>
              <Tooltip
                title={isSelected ? t('Remove from plan') : t('Add to plan')}
                disabled={isHumanAction}
              >
                <SelectionButton
                  onClick={isHumanAction ? handleDeleteClick : handleSelectionToggle}
                  aria-label={isSelected ? t('Remove from plan') : t('Add to plan')}
                  actionType={isHumanAction ? 'delete' : isSelected ? 'close' : 'add'}
                >
                  {isHumanAction ? (
                    <IconDelete size="xs" />
                  ) : isSelected ? (
                    <IconClose size="xs" />
                  ) : (
                    <IconAdd size="xs" />
                  )}
                </SelectionButton>
              </Tooltip>
            </SelectionButtonWrapper>
          </IconWrapper>
        </StyledTimelineHeader>
      }
      isActive={isActive}
      icon={getEventIcon(event.timeline_item_type)}
      colorConfig={getEventColor(theme, isActive, isSelected)}
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
                <AutofixHighlightWrapper
                  groupId={groupId}
                  runId={runId}
                  stepIndex={stepIndex}
                  retainInsightCardIndex={retainInsightCardIndex}
                >
                  <StyledSpan dangerouslySetInnerHTML={analysisHtml} />
                </AutofixHighlightWrapper>
              </Timeline.Text>
            </AnimatedContent>
          )}
        </AnimatePresence>
      )}
    </Timeline.Item>
  );
}

const StyledIconChevron = styled(IconChevron)`
  color: ${p => p.theme.subText};
  flex-shrink: 0;
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: ${space(1)};
`;

const SelectionButtonWrapper = styled('div')`
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

type SelectionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  actionType: 'delete' | 'close' | 'add';
};

const SelectionButton = styled('button')<SelectionButtonProps>`
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${p => p.theme.subText};
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
  border-radius: 5px;
  padding: 4px;

  &:hover {
    color: ${p =>
      p.actionType === 'delete' || p.actionType === 'close'
        ? p.theme.red400
        : p.theme.green400};
  }
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
  text-decoration: ${p => (p.isSelected ? 'none' : 'line-through')};
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

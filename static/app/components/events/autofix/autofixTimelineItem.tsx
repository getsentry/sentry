import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import AutofixInsightSources from 'sentry/components/events/autofix/insights/autofixInsightSources';
import type {TimelineItemProps} from 'sentry/components/timeline';
import {Timeline} from 'sentry/components/timeline';
import {IconBroadcast, IconChevron, IconCode, IconUser} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {MarkedText} from 'sentry/utils/marked/markedText';

import type {AutofixTimelineEvent} from './types';

function getEventIcon(eventType: AutofixTimelineEvent['timeline_item_type']) {
  const iconProps = {
    style: {
      margin: 3,
    },
  };

  switch (eventType) {
    case 'external_system':
      return <IconBroadcast {...iconProps} />;
    case 'internal_code':
      return <IconCode {...iconProps} />;
    case 'human_action':
      return <IconUser {...iconProps} />;
    default:
      return <IconCode {...iconProps} />;
  }
}

function getEventColor(
  theme: Theme,
  isActive?: boolean
): TimelineItemProps['colorConfig'] {
  return {
    title: theme.tokens.content.primary,
    icon: isActive ? theme.colors.pink400 : theme.tokens.content.muted,
    iconBorder: isActive ? theme.colors.pink400 : theme.tokens.content.muted,
  };
}

interface AutofixTimelineItemProps {
  event: AutofixTimelineEvent;
  groupId: string;
  index: number;
  isExpanded: boolean;
  isMostImportantEvent: boolean;
  onToggleExpand: (index: number) => void;
  retainInsightCardIndex: number | null | undefined;
  runId: string;
  stepIndex: number;
  codeUrl?: string | null;
  getCustomIcon?: (event: AutofixTimelineEvent) => React.ReactNode | undefined;
}

export function AutofixTimelineItem({
  event,
  getCustomIcon,
  groupId,
  index,
  isExpanded,
  isMostImportantEvent,
  onToggleExpand,
  retainInsightCardIndex,
  runId,
  stepIndex,
  codeUrl,
}: AutofixTimelineItemProps) {
  const theme = useTheme();

  const handleToggle = () => {
    onToggleExpand(index);
  };

  const titleHtml = useMemo(() => {
    return {__html: singleLineRenderer(event.title)};
  }, [event.title]);

  return (
    <Timeline.Item
      title={
        <StyledTimelineHeader
          onClick={handleToggle}
          isActive={isMostImportantEvent}
          data-test-id={`autofix-root-cause-timeline-item-${index}`}
        >
          <AutofixHighlightWrapper
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={retainInsightCardIndex}
          >
            <div dangerouslySetInnerHTML={titleHtml} />
          </AutofixHighlightWrapper>
          <StyledIconChevron direction={isExpanded ? 'up' : 'down'} size="xs" />
        </StyledTimelineHeader>
      }
      isActive={isMostImportantEvent}
      icon={getCustomIcon?.(event) ?? getEventIcon(event.timeline_item_type)}
      colorConfig={getEventColor(theme, isMostImportantEvent)}
    >
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
                <StyledSpan
                  as="span"
                  text={replaceHeadersWithBold(event.code_snippet_and_analysis)}
                  inline
                />
              </AutofixHighlightWrapper>
              {codeUrl && (
                <SourcesWrapper>
                  <AutofixInsightSources codeUrls={[codeUrl]} />
                </SourcesWrapper>
              )}
            </Timeline.Text>
          </AnimatedContent>
        )}
      </AnimatePresence>
    </Timeline.Item>
  );
}

const AnimatedContent = styled(motion.div)`
  overflow: hidden;
`;

const StyledSpan = styled(MarkedText)`
  & code {
    font-size: ${p => p.theme.fontSize.sm};
    background-color: transparent;
    display: inline-block;
  }
`;

const SourcesWrapper = styled('div')`
  margin-top: ${space(2)};
`;

const StyledTimelineHeader = styled('div')<{isActive?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${p => p.theme.space[0]} ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.md};
  cursor: pointer;
  font-weight: ${p => p.theme.fontWeight.normal};
  gap: ${space(1)};
  text-decoration: ${p => (p.isActive ? 'underline dashed' : 'none')};
  text-decoration-color: ${p => p.theme.colors.pink400};
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;

  & > span:first-of-type {
    flex: 1;
    min-width: 0;
    margin-right: ${space(1)};
  }

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const StyledIconChevron = styled(IconChevron)`
  color: ${p => p.theme.tokens.content.secondary};
  flex-shrink: 0;
  margin-right: ${space(0.25)};
`;

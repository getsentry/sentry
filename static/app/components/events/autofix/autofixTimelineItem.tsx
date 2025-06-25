import {useMemo, useState} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import AutofixInsightSources from 'sentry/components/events/autofix/autofixInsightSources';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import type {TimelineItemProps} from 'sentry/components/timeline';
import {Timeline} from 'sentry/components/timeline';
import {IconBroadcast, IconChevron, IconCode, IconUser} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

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
  if (isChonkTheme(theme)) {
    return {
      title: theme.colors.content.primary,
      icon: isActive ? theme.colors.pink400 : theme.colors.content.muted,
      iconBorder: isActive ? theme.colors.pink400 : theme.colors.content.muted,
    };
  }
  return {
    title: theme.gray400,
    icon: isActive ? theme.pink400 : theme.gray400,
    iconBorder: isActive ? theme.pink400 : theme.gray400,
  };
}

interface AutofixTimelineItemProps {
  event: AutofixTimelineEvent;
  groupId: string;
  index: number;
  isMostImportantEvent: boolean;
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
  isMostImportantEvent,
  retainInsightCardIndex,
  runId,
  stepIndex,
  codeUrl,
}: AutofixTimelineItemProps) {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded(current => !current);
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
  padding: ${space(0.25)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  font-weight: ${p => (p.isActive ? p.theme.fontWeightBold : p.theme.fontWeightNormal)};
  gap: ${space(1)};

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
  color: ${p => p.theme.subText};
  flex-shrink: 0;
  margin-right: ${space(0.25)};
`;

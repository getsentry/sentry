import {useState} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import type {TimelineItemProps} from 'sentry/components/timeline';
import {Timeline} from 'sentry/components/timeline';
import {IconBroadcast, IconChevron, IconCode, IconUser} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

import type {AutofixTimelineEvent} from './types';

type Props = {
  events: AutofixTimelineEvent[];
  groupId: string;
  runId: string;
  getCustomIcon?: (event: AutofixTimelineEvent) => React.ReactNode;
  retainInsightCardIndex?: number | null;
  stepIndex?: number;
};

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

export function AutofixTimeline({
  events,
  getCustomIcon,
  groupId,
  runId,
  stepIndex = 0,
  retainInsightCardIndex = null,
}: Props) {
  const theme = useTheme();
  const [expandedItems, setExpandedItems] = useState<number[]>([]);

  if (!events?.length) {
    return null;
  }

  const toggleItem = (index: number) => {
    setExpandedItems(current =>
      current.includes(index) ? current.filter(i => i !== index) : [...current, index]
    );
  };

  return (
    <Timeline.Container>
      {events.map((event, index) => {
        const isActive = event.is_most_important_event && index !== events.length - 1;

        return (
          <Timeline.Item
            key={index}
            title={
              <StyledTimelineHeader
                onClick={() => toggleItem(index)}
                isActive={isActive}
                data-test-id={`autofix-root-cause-timeline-item-${index}`}
              >
                <AutofixHighlightWrapper
                  groupId={groupId}
                  runId={runId}
                  stepIndex={stepIndex}
                  retainInsightCardIndex={retainInsightCardIndex}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: singleLineRenderer(event.title),
                    }}
                  />
                </AutofixHighlightWrapper>
                <StyledIconChevron
                  direction={expandedItems.includes(index) ? 'down' : 'right'}
                  size="xs"
                />
              </StyledTimelineHeader>
            }
            isActive={isActive}
            icon={getCustomIcon?.(event) ?? getEventIcon(event.timeline_item_type)}
            colorConfig={getEventColor(theme, isActive)}
          >
            <AnimatePresence>
              {expandedItems.includes(index) && (
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
                        dangerouslySetInnerHTML={{
                          __html: singleLineRenderer(
                            replaceHeadersWithBold(event.code_snippet_and_analysis)
                          ),
                        }}
                      />
                    </AutofixHighlightWrapper>
                  </Timeline.Text>
                </AnimatedContent>
              )}
            </AnimatePresence>
          </Timeline.Item>
        );
      })}
    </Timeline.Container>
  );
}

const AnimatedContent = styled(motion.div)`
  overflow: hidden;
`;

const StyledSpan = styled('span')`
  & code {
    font-size: ${p => p.theme.fontSizeExtraSmall};
    display: inline-block;
  }
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

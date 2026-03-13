import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  hasFlamegraphData,
  StacktraceFlamegraph,
} from 'sentry/components/events/interfaces/crashContent/stackTrace/flamegraph';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export interface HangProfileData {
  exceptionValue: string;
  frames: Frame[];
}

/**
 * Extracts frames with flamegraph data and the associated exception info
 * from the event's exception entry.
 */
export function getHangProfileData(event: Event): HangProfileData | null {
  for (const entry of event.entries) {
    if (entry.type === EntryType.EXCEPTION) {
      for (const value of entry.data.values ?? []) {
        if (hasFlamegraphData(value.stacktrace?.frames)) {
          return {
            frames: value.stacktrace!.frames!,
            exceptionValue: value.value,
          };
        }
      }
    }

    if (entry.type === EntryType.STACKTRACE) {
      if (hasFlamegraphData(entry.data.frames)) {
        return {
          frames: entry.data.frames!,
          exceptionValue: '',
        };
      }
    }

    if (entry.type === EntryType.THREADS) {
      for (const thread of entry.data.values ?? []) {
        if (hasFlamegraphData(thread.stacktrace?.frames)) {
          return {
            frames: thread.stacktrace!.frames!,
            exceptionValue: '',
          };
        }
      }
    }
  }

  return null;
}

export function MetricKitHangProfileSection({data}: {data: HangProfileData}) {
  return (
    <ErrorBoundary mini>
      <InterimSection
        type={SectionKey.STACKTRACE_FLAMEGRAPH}
        title={
          <span>
            {t('Hang Profile')}
            &nbsp;
            <QuestionTooltip
              position="bottom"
              size="sm"
              title={t('This profile was reported by MetricKit during the app hang.')}
            />
          </span>
        }
      >
        {data.exceptionValue && <StyledPre>{data.exceptionValue}</StyledPre>}
        <StacktraceFlamegraph frames={data.frames} />
      </InterimSection>
    </ErrorBoundary>
  );
}

const StyledPre = styled('pre')`
  padding: 0;
  margin: 0 0 ${p => p.theme.space.md} 0;
  word-wrap: break-word;
  white-space: pre-wrap;
  background-color: inherit;
`;

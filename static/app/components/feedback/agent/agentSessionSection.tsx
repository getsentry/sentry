import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {IconMegaphone} from '@sentry/icons/megaphone';
import {IconTerminal} from '@sentry/icons/terminal';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/codeBlock';
import {getDuration} from '@sentry/scraps/duration';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {FeedbackItemSection} from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {KeyValueTableCard} from 'sentry/components/tables/keyValueTable';
import {t, tn} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getScalarAttributeValue,
  useTraceItemDetails,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/traceUrl';

import {AGENT_TAG, getEventTag} from './agentFeedback';
import {
  getSessionSpanQuery,
  getSessionWindow,
  SESSION_LOOKBACK_MS,
  unquote,
  useAgentSession,
  type AgentToolCall,
} from './useAgentSession';

interface Props {
  eventData: Event;
  feedbackItem: FeedbackIssue;
}

const IDLE_GAP_MS = 5 * 60_000;
const ROW_COLUMNS = '64px minmax(0, 240px) minmax(0, 1fr) 56px 20px';
const NOTE_COLUMNS = '64px minmax(0, 1fr)';
const ARGUMENT_ATTRIBUTE = /mcp\.request\.argument\.([\w-]+)/;
const ERROR_HEADING = /^\*\*.+\*\*$/;

/**
 * The agent's equivalent of a replay: the tool calls it made in the run-up to
 * the report, with what it asked for, what came back, and what we logged.
 */
export function AgentSessionSection({eventData, feedbackItem}: Props) {
  const organization = useOrganization();
  const userId = eventData.user?.id ?? undefined;
  const projectId = feedbackItem.project?.id;
  const reportedTool = getEventTag(eventData, AGENT_TAG.tool);
  const reportedAt = new Date(feedbackItem.firstSeen).getTime();

  const {toolCalls, isPending, isError, isTruncated} = useAgentSession({
    feedbackTime: feedbackItem.firstSeen,
    projectId,
    userId,
  });

  const lookbackMinutes = SESSION_LOOKBACK_MS / 60_000;
  const reportedCallId = findReportedCall(
    toolCalls,
    reportedTool,
    feedbackItem.metadata.message
  )?.id;

  const exploreUrl =
    userId && projectId
      ? getExploreUrl({
          organization,
          query: getSessionSpanQuery(userId),
          field: ['mcp.tool.name', 'span.status', 'span.duration', 'timestamp'],
          sort: '-timestamp',
          selection: {
            datetime: {
              ...getSessionWindow(feedbackItem.firstSeen),
              period: null,
              utc: true,
            },
            environments: [],
            projects: [Number(projectId)],
          },
        })
      : undefined;

  return (
    <FeedbackItemSection
      collapsible
      icon={<IconTerminal size="xs" />}
      sectionKey="agent-session"
      title={t('Agent Session')}
      actions={
        exploreUrl ? (
          <LinkButton size="xs" to={exploreUrl}>
            {t('Open in Explore')}
          </LinkButton>
        ) : null
      }
    >
      {isPending ? (
        <Placeholder height="160px" />
      ) : isError ? (
        <Text variant="muted">
          {t('Unable to load the tool calls for this session.')}
        </Text>
      ) : userId && projectId ? (
        toolCalls.length ? (
          <Stack gap="md">
            <SessionSummary
              toolCalls={toolCalls}
              reportedAt={reportedAt}
              reportedTool={reportedTool}
              isTruncated={isTruncated}
            />
            <Stack border="primary" radius="md" overflow="hidden">
              {toolCalls.map((call, index) => {
                const previous = toolCalls[index - 1];
                const idleMs = previous ? call.startMs - previous.startMs : 0;
                return (
                  <Fragment key={call.id}>
                    {idleMs > IDLE_GAP_MS ? (
                      <Flex justify="center" padding="xs" background="secondary">
                        <Text variant="muted" size="xs">
                          {t('%s idle', getDuration(idleMs / 1000, {style: 'short'}))}
                        </Text>
                      </Flex>
                    ) : null}
                    <ToolCallRow
                      call={call}
                      isReportedCall={call.id === reportedCallId}
                      isReportedTool={call.tool === reportedTool}
                      projectId={projectId}
                      reportedAt={reportedAt}
                    />
                  </Fragment>
                );
              })}
              <Grid columns={ROW_COLUMNS} gap="md" align="center" padding="sm md">
                <Text variant="muted" size="sm" tabular>
                  {t('0s')}
                </Text>
                <Flex gap="sm" align="center">
                  <IconMegaphone size="xs" variant="accent" />
                  <Text size="sm" bold>
                    {t('Feedback submitted')}
                  </Text>
                </Flex>
              </Grid>
            </Stack>
          </Stack>
        ) : (
          <Text variant="muted">
            {t(
              'No tool calls were recorded for this agent in the %s minutes before the report. They may have been sampled out.',
              lookbackMinutes
            )}
          </Text>
        )
      ) : (
        <Text variant="muted">
          {t('This report has no user, so its tool calls cannot be found.')}
        </Text>
      )}
    </FeedbackItemSection>
  );
}

/**
 * The failed call the report is most plausibly about: a failure of the tool
 * the agent named. When that tool failed more than once, a call whose argument
 * the agent quoted in its report wins, otherwise the last one before the report.
 */
function findReportedCall(
  toolCalls: AgentToolCall[],
  reportedTool: string | undefined,
  message: string
) {
  const failures = toolCalls.filter(call => call.failed && call.tool === reportedTool);
  return (
    failures.findLast(call => call.argument && message.includes(call.argument.value)) ??
    failures.at(-1)
  );
}

interface SessionProps {
  reportedAt: number;
  reportedTool: string | undefined;
  toolCalls: AgentToolCall[];
}

/**
 * The one-line read of the session: how long, how rough, and how much of it
 * was spent on the tool the agent complained about.
 */
function SessionSummary({
  toolCalls,
  reportedAt,
  reportedTool,
  isTruncated,
}: SessionProps & {isTruncated: boolean}) {
  const failed = toolCalls.filter(call => call.failed);
  const stuck = failed.filter(call => !call.recovered);
  const reportedToolCalls = toolCalls.filter(call => call.tool === reportedTool);
  const sessionMs = reportedAt - toolCalls[0]!.startMs;

  const parts = [
    tn(
      '%s tool call over %s',
      '%s tool calls over %s',
      toolCalls.length,
      getDuration(sessionMs / 1000, {style: 'short'})
    ),
    failed.length
      ? stuck.length
        ? t('%s failed, %s never succeeded on retry', failed.length, stuck.length)
        : t('%s failed, all succeeded on retry', failed.length)
      : t('none failed'),
    reportedTool
      ? tn('%s call to %s', '%s calls to %s', reportedToolCalls.length, reportedTool)
      : null,
    isTruncated ? t('showing the most recent') : null,
  ];

  return (
    <Text variant="muted" size="sm">
      {parts.filter(Boolean).join(' · ')}
    </Text>
  );
}

function ToolCallRow({
  call,
  isReportedCall,
  isReportedTool,
  projectId,
  reportedAt,
}: {
  call: AgentToolCall;
  isReportedCall: boolean;
  isReportedTool: boolean;
  projectId: string;
  reportedAt: number;
}) {
  // The call the report is about starts open, so the answer is on screen.
  const [isExpanded, setIsExpanded] = useState(isReportedCall);

  // The warning we log for a failed call usually repeats what the tool
  // returned to the agent, so only show the ones that add something.
  const notableLogs = call.logs.filter(
    log =>
      (isExpanded || log.severity !== 'info') &&
      !(log.detail && call.error?.includes(log.detail))
  );

  // Once the call is open the full result is right there.
  const inlineError = isExpanded ? null : call.error;

  return (
    <Stack borderBottom="primary">
      <CallRow data-failed={call.failed} onClick={() => setIsExpanded(!isExpanded)}>
        <Grid columns={ROW_COLUMNS} gap="md" align="center" padding="sm md">
          <Text variant="muted" size="sm" tabular>
            {formatOffset(call.startMs - reportedAt)}
          </Text>
          <Flex gap="sm" align="center" minWidth={0}>
            <Text
              size="sm"
              monospace
              ellipsis
              bold={isReportedTool}
              variant={isReportedTool ? 'accent' : 'primary'}
            >
              {call.tool}
            </Text>
            {call.failed ? <Tag variant="danger">{t('failed')}</Tag> : null}
            {call.isRetry ? <Tag variant="info">{t('retry')}</Tag> : null}
            {isReportedCall ? <Tag variant="promotion">{t('reported')}</Tag> : null}
          </Flex>
          <Text size="sm" variant="muted" monospace ellipsis>
            {call.argument ? `${call.argument.key}: ${call.argument.value}` : null}
          </Text>
          <Text size="sm" variant="muted" tabular align="right">
            {formatCallDuration(call.durationMs)}
          </Text>
          <Button
            size="zero"
            variant="transparent"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t('Collapse') : t('Expand')}
            icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
            onClick={event => {
              // The row toggles on click too.
              event.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          />
        </Grid>
      </CallRow>

      {inlineError || notableLogs.length ? (
        <Stack gap="xs" padding="xs md sm md">
          {inlineError ? (
            <Grid columns={NOTE_COLUMNS} gap="md">
              <span />
              <Text size="sm" variant="danger" wordBreak="break-word">
                {inlineError}
              </Text>
            </Grid>
          ) : null}
          {notableLogs.map((log, index) => (
            <Grid key={index} columns={NOTE_COLUMNS} gap="md" align="start">
              <Flex justify="end">
                <Tag variant={getSeverityVariant(log.severity)}>{log.severity}</Tag>
              </Flex>
              <Text size="sm" wordBreak="break-word">
                {log.message}
                {log.detail ? (
                  <Text size="sm" variant="muted">
                    {' — '}
                    {log.detail}
                  </Text>
                ) : null}
              </Text>
            </Grid>
          ))}
        </Stack>
      ) : null}

      {isExpanded ? <ToolCallDetail call={call} projectId={projectId} /> : null}
    </Stack>
  );
}

/**
 * Everything recorded for one call. The list only carries one argument per
 * call, so the rest are fetched when a call is opened.
 */
function ToolCallDetail({call, projectId}: {call: AgentToolCall; projectId: string}) {
  const organization = useOrganization();
  const location = useLocation();

  const {data, isPending} = useTraceItemDetails({
    projectId,
    traceId: call.traceId,
    traceItemId: call.id,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.organization-trace-item-details',
    timestamp: call.startMs / 1000,
  });

  const callArguments = (data?.attributes ?? []).flatMap(attribute => {
    const key = attribute.name.match(ARGUMENT_ATTRIBUTE)?.[1];
    return key
      ? [
          {
            item: {
              key,
              subject: key,
              value: unquote(String(getScalarAttributeValue(attribute))),
            },
          },
        ]
      : [];
  });

  const traceUrl = getTraceDetailsUrl({
    organization,
    traceSlug: call.traceId,
    dateSelection: normalizeDateTimeParams({}),
    timestamp: call.startMs / 1000,
    location,
  });

  return (
    <Grid columns={NOTE_COLUMNS} gap="md" padding="xs md md md">
      <span />
      {/* The cards space themselves. */}
      <Stack minWidth={0}>
        {isPending ? (
          <Placeholder height="72px" />
        ) : (
          <KeyValueTableCard title={t('Arguments')} contentItems={callArguments}>
            {callArguments.length ? null : (
              <Text size="sm" variant="muted">
                {t('This call had no arguments.')}
              </Text>
            )}
          </KeyValueTableCard>
        )}

        <ToolCallResult call={call} />

        <Flex justify="end">
          <LinkButton size="xs" to={traceUrl}>
            {t('View Trace')}
          </LinkButton>
        </Flex>
      </Stack>
    </Grid>
  );
}

/**
 * What the tool handed back to the agent. Tools answer in markdown or JSON,
 * and the recording is cut off past a size limit.
 */
function ToolCallResult({call}: {call: AgentToolCall}) {
  if (!call.result) {
    return (
      <Text size="sm" variant="muted">
        {t('No result was recorded for this call.')}
      </Text>
    );
  }

  const isJson = /^\s*[{[]/.test(call.result);

  return (
    <KeyValueTableCard title={t('Returned to Agent')}>
      <Container padding="xs sm">
        {isJson ? (
          <CodeBlock language="json" wrapMode="wrap">
            {formatJson(call.result)}
          </CodeBlock>
        ) : call.failed ? (
          // Errors are a few short paragraphs, so they are laid out here
          // rather than as a markdown document with its own spacing.
          <Stack gap="sm">
            {call.result
              .split(/\n{2,}/)
              .map(block => block.trim())
              .filter(Boolean)
              .map((block, index) =>
                ERROR_HEADING.test(block) ? (
                  <Text key={index} size="sm" bold variant="danger">
                    {block.replaceAll('**', '')}
                  </Text>
                ) : (
                  <Text key={index} size="sm" wordBreak="break-word">
                    <MarkedText inline as="span" text={block} />
                  </Text>
                )
              )}
          </Stack>
        ) : (
          <ResultMarkdown text={call.result} />
        )}
      </Container>
    </KeyValueTableCard>
  );
}

function getSeverityVariant(severity: string) {
  if (severity === 'error' || severity === 'fatal') {
    return 'danger';
  }
  if (severity === 'warn') {
    return 'warning';
  }
  return 'muted';
}

/** `-2m 13s` for a call that started two minutes before the report. */
function formatOffset(offsetMs: number) {
  const totalSeconds = Math.round(Math.abs(offsetMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const sign = offsetMs < 0 ? '-' : '+';
  return minutes ? `${sign}${minutes}m ${seconds}s` : `${sign}${seconds}s`;
}

function formatCallDuration(durationMs: number) {
  return getDuration(durationMs / 1000, {
    precision: durationMs < 1000 ? 0 : 1,
    style: 'short',
  });
}

function formatJson(result: string) {
  try {
    return JSON.stringify(JSON.parse(result), null, 2);
  } catch {
    // Results are truncated when recorded, so they are often not valid JSON.
    return result;
  }
}

const CallRow = styled('div')`
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
  &[data-failed='true'] {
    background: ${p => p.theme.tokens.background.transparent.danger.muted};
  }
`;

const ResultMarkdown = styled(MarkedText)`
  font-size: ${p => p.theme.font.size.sm};
  word-break: break-word;
`;

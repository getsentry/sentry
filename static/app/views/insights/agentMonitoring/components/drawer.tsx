import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import useDrawer from 'sentry/components/globalDrawer';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Timeline} from 'sentry/components/timeline';
import {IconCode, IconLink, IconSort} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconSpeechBubble} from 'sentry/icons/iconSpeechBubble';
import {IconTool} from 'sentry/icons/iconTool';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {convertRawSpanToEAPSpan} from 'sentry/utils/convertRawSpanToEAPSpan';
import getDuration from 'sentry/utils/duration/getDuration';
import {createWaterfallData, WaterfallSpanData} from 'sentry/utils/traceWaterfallData';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  AI_GENERATION_DESCRIPTIONS,
  AI_GENERATION_OPS,
  AI_RUN_DESCRIPTIONS,
  AI_RUN_OPS,
  AI_TOOL_CALL_OPS,
  getIsAiSpanLoose,
  mapMissingSpanOp,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {
  AIInputSectionSimple,
  parseAIMessages,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';
import {AIOutputSectionSimple} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiOutput';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface UseTraceViewDrawerProps {
  onClose?: () => void;
}

export function useTraceViewDrawer({onClose = undefined}: UseTraceViewDrawerProps) {
  const {openDrawer, isDrawerOpen} = useDrawer();

  const openTraceViewDrawer = (traceId: string, eventId: string, projectSlug: string) =>
    openDrawer(
      () => (
        <FullHeightWrapper>
          <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
            <AITraceView traceId={traceId} eventId={eventId} projectSlug={projectSlug} />
          </TraceStateProvider>
        </FullHeightWrapper>
      ),
      {
        ariaLabel: t('Trace'),
        onClose,
        shouldCloseOnInteractOutside: () => true,
        drawerWidth: '60%',
      }
    );

  return {
    openTraceViewDrawer,
    isTraceViewDrawerOpen: isDrawerOpen,
  };
}

const FullHeightWrapper = styled('div')`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

function AITraceView({
  traceId,
  eventId,
  projectSlug,
}: {
  eventId: string;
  projectSlug: string;
  traceId: string;
}) {
  const [selectedSpan, setSelectedSpan] = useState<WaterfallSpanData>();
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();

  const traceViewTarget = getTraceDetailsUrl({
    eventId: traceId,
    source: TraceViewSources.LLM_MODULE, // TODO: change source to AGENT_MONITORING
    organization,
    location,
    traceSlug: traceId,
    dateSelection: normalizeDateTimeParams(selection),
  });

  const useTraceResult = useTrace({
    traceSlug: traceId,
  });

  const {data: tx} = useTransaction({
    event_id: eventId,
    organization,
    project_slug: projectSlug,
  });

  const trace = useTraceResult.data;

  // @ts-expect-error get transaction from trace
  const transaction = trace.transactions[0]!;

  const txSpan: WaterfallSpanData = {
    ...({} as RawSpanType),
    id: '0',
    op: transaction['transaction.op'] || '',
    description: transaction['transaction.description'] || '',
    data: {},
    span_id: '0',
    parent_span_id: undefined,
    start_timestamp: 0,
    timestamp: 0,
    startTime: 0,
    endTime: 0,
    duration: transaction['transaction.duration'] / 1000,
    depth: 0,
    parentId: null,
    color: 'gray400',
    icon: 'clock' as const,
    displayTitle: transaction['transaction.op'] || '',
    displayText: transaction['transaction.description'] || '',
    relativeStart: 0,
    relativeEnd: 0,
    widthPercent: 100,
    leftPercent: 0,
  };

  const spans = (tx?.entries[0]?.data as RawSpanType[]) ?? [];
  const aiSpans = spans.filter(span => getIsAiSpanLoose(span));

  const waterfallspans: WaterfallSpanData[] = createWaterfallData(aiSpans);

  useEffect(() => {
    if (!selectedSpan && waterfallspans.length > 0) {
      setSelectedSpan(waterfallspans[0] as WaterfallSpanData);
    }
  }, [selectedSpan, waterfallspans]);

  if (!tx || !trace) {
    return null;
  }

  return (
    <Wrapper>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {t('Trace')}
            </TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              clipboardText={traceId}
              subTitle={`Trace ID: ${traceId}`}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        <LinkButton to={traceViewTarget} size="sm" icon={<IconLink size="sm" />}>
          {t('View full trace')}
        </LinkButton>
      </TraceDrawerComponents.HeaderContainer>

      <TraceDrawerComponents.BodyContainer>
        <Flex gap={space(1)}>
          <Flex.Item style={{width: '52%'}}>
            <div>
              <b>{transaction['transaction.op']}</b>
            </div>
            <p />
            <h6>Spans</h6>
            <Timeline.Container>
              <SpanItem
                span={txSpan}
                onClick={() => {}}
                isSelected={selectedSpan?.id === txSpan.span_id}
              />
              {waterfallspans.map(span => (
                <SpanItem
                  key={span.span_id}
                  span={span}
                  onClick={setSelectedSpan}
                  isSelected={selectedSpan?.id === span.span_id}
                />
              ))}
            </Timeline.Container>
          </Flex.Item>
          {selectedSpan && (
            <Flex.Item style={{width: '48%'}}>
              <TraceDrawerComponents.Highlights
                node={convertRawSpanToEAPSpan(selectedSpan)}
                transaction={tx}
                avgDuration={0}
                project={undefined}
                headerContent={''}
                bodyContent={''}
              />
              <PromotedAttributes attributes={selectedSpan.data} />
              <p />
              <p>
                <b>Other Attributes</b>
              </p>
              <KeyValueTable>
                {Object.entries(selectedSpan.data || {})
                  .filter(([k, _]) => k.includes('ai.'))
                  .map(([key, value]) => (
                    <KeyValueTableRow key={key} keyName={key} value={value} />
                  ))}
              </KeyValueTable>
            </Flex.Item>
          )}
        </Flex>
      </TraceDrawerComponents.BodyContainer>
    </Wrapper>
  );
}

function SpanItem({
  span,
  onClick,
  isSelected,
}: {
  isSelected: boolean;
  onClick: (span: WaterfallSpanData) => void;
  span: WaterfallSpanData;
}) {
  const op = mapMissingSpanOp({
    op: span.op,
    description: span.description,
  });

  let icon = <IconCode size="sm" />;
  let color = 'gray400';
  let title = span.op;
  let text = span.description;
  if (AI_TOOL_CALL_OPS.includes(op)) {
    icon = <IconTool size="sm" />;
    color = 'green400';
    title = span.description;
    text = span.data?.['ai.toolCall.name'];
  } else if (
    AI_GENERATION_OPS.includes(op) ||
    AI_GENERATION_DESCRIPTIONS.includes(span.description ?? '')
  ) {
    icon = <IconSpeechBubble size="sm" />;
    color = 'blue400';
    title = 'ai.doGenerate';
    text = span.data?.['gen_ai.request.model'];
  } else if (
    AI_RUN_OPS.includes(op) ||
    AI_RUN_DESCRIPTIONS.includes(span.description ?? '')
  ) {
    icon = <IconBot size="sm" />;
    color = 'gray400';
    title = 'Agent';
    text = tryParseJson(span.data?.['ai.prompt'] ?? '{}').prompt;
  } else if (span.op === 'http.client') {
    icon = <IconSort rotated size="sm" />;
    color = 'gray300';
    title = span.description;
    text = span.data?.['http.url'];
  }

  return (
    <StyledTimelineItem
      isSelected={isSelected}
      title={<StyledTimelineItemTitle>{title}</StyledTimelineItemTitle>}
      icon={icon}
      onClick={() => onClick(span)}
      colorConfig={{
        title: color,
        icon: color,
        iconBorder: color,
      }}
      timestamp={<WaterfallProgress span={span} />}
    >
      <StyledTimelineText>{text}</StyledTimelineText>
    </StyledTimelineItem>
  );
}

function WaterfallProgress({span}: {span: WaterfallSpanData}) {
  const getColor = (colorName: string) => {
    switch (colorName) {
      case 'green400':
        return '#40c89a';
      case 'blue400':
        return '#669bf8';
      case 'gray300':
        return '#D1D5DB';
      default:
        return '#C1C5CB';
    }
  };

  return (
    <WaterfallContainer>
      <WaterfallBar
        style={{
          left: `${span.leftPercent}%`,
          width: `${Math.max(span.widthPercent, 2)}%`,
          backgroundColor: getColor(span.color),
        }}
      />
      <WaterfallDuration>{getDuration(span.duration, 2, true)}</WaterfallDuration>
    </WaterfallContainer>
  );
}

function PromotedAttributes({
  attributes,
}: {
  attributes: Record<string, string> | undefined;
}) {
  if (!attributes) {
    return null;
  }

  const promptMessages = parseAIMessages(attributes['ai.prompt.messages'] ?? '');
  const onlyPrompt = tryParseJson(attributes['ai.prompt'] ?? '{}').prompt;
  const responseText = tryParseJson(attributes['ai.response.text'] ?? '{}').text;
  const toolCalls = tryParseJson(attributes['ai.response.toolCalls'] ?? '{}');

  return (
    <div>
      {promptMessages && (
        <AIInputSectionSimple promptMessages={promptMessages as string} />
      )}
      {!promptMessages && onlyPrompt && (
        <AIInputSectionSimple promptMessages={onlyPrompt as string} />
      )}
      {responseText && (
        <AIOutputSectionSimple responseText={responseText} toolCalls={toolCalls} />
      )}
    </div>
  );
}

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

const Wrapper = styled('div')`
  height: 100%;
  padding: ${space(2)};
`;

const StyledTimelineItemTitle = styled('div')`
  width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledTimelineItem = styled(Timeline.Item)<{isSelected: boolean}>`
  cursor: pointer;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
  margin-bottom: ${space(1)};
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  background-color: ${p => p.theme.background};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  ${p => p.isSelected && `background-color: ${p.theme.backgroundSecondary};`}
`;

const WaterfallContainer = styled('div')`
  position: relative;
  width: 200px;
  height: 20px;
  background-color: ${p => p.theme.gray100};
  border: 1px solid ${p => p.theme.border};
  border-radius: 4px;
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const WaterfallBar = styled('div')`
  position: absolute;
  height: 100%;
  border-radius: 2px;
  opacity: 0.9;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
`;

const WaterfallDuration = styled('span')`
  position: absolute;
  right: ${space(0.5)};
  font-size: 11px;
  color: ${p => p.theme.textColor};
  z-index: 1;
`;

const StyledTimelineText = styled('div')`
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

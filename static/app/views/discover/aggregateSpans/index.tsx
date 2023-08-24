import styled from '@emotion/styled';

import {Spans} from 'sentry/components/events/interfaces/spans';
import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';
import {EntryType, EventOrGroupType, EventTransaction} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function formatSpan(span) {
  const {
    node_fingerprint: span_id,
    parent_node_fingerprint: parent_span_id,
    'any(description)': description,
    'any(op)': op,
    'p95(exclusive_time)': exclusive_time,
    'p50(offset)': offset,
    parent_start_timestamp,
    'uniq(transaction_id)': count,
    ...rest
  } = span;
  const start_timestamp = (parent_start_timestamp ?? 0) + offset;
  return {
    ...rest,
    span_id,
    parent_span_id,
    description,
    exclusive_time,
    op,
    timestamp: start_timestamp + exclusive_time / 1000,
    start_timestamp,
    trace_id: '10ff38656613473bac1675edfe1e17d5', // not actually trace_id just a placeholder
    count,
  };
}

function AggregateSpans({params}) {
  const organization = useOrganization();
  const location = useLocation();
  const transaction = location.query.transaction;

  const eventSlug = typeof params.eventSlug === 'string' ? params.eventSlug.trim() : '';

  const spans = useQuery<{children: {}}[]>({
    queryKey: ['spans', {eventSlug}],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8080/?transaction=${transaction}`);
      return await response.json();
    },
    initialData: [],
  });

  const spanQueue = [spans.data];
  const flattenedSpans: any[] = [];
  while (spanQueue.length > 0) {
    const {children, ...span} = spanQueue.shift();
    const formattedSpan = formatSpan(span);
    flattenedSpans.push(formattedSpan);
    if (children) {
      spanQueue.push(
        ...children.map(child => ({
          ...child,
          parent_start_timestamp: formattedSpan.start_timestamp,
        }))
      );
    }
  }

  const maxCount = Math.max(...flattenedSpans.map(span => span.count));
  // Not exactly correct because maxCount isnt guaranteed to be to total number of transactions
  flattenedSpans.forEach(span => {
    span.frequency = span.count / maxCount;
  });

  const event: EventTransaction = {
    contexts: {
      trace: {
        trace_id: '10ff38656613473bac1675edfe1e17d5',
        span_id: '9e324eaff5381c5f',
        op: 'navigation',
        status: 'unknown',
        exclusive_time: 842.501163,
        hash: '681ce0178e0f10c0',
        type: 'trace',
      },
    },
    endTimestamp: 0,
    entries: [
      {
        data: flattenedSpans as RawSpanType[],
        type: EntryType.SPANS,
      },
    ],
    startTimestamp: 0,
    type: EventOrGroupType.TRANSACTION,
    crashFile: null,
    culprit: '',
    dateReceived: '',
    dist: null,
    errors: [],
    eventID: '',
    fingerprints: [],
    id: '',
    location: null,
    message: '',
    metadata: {
      current_level: undefined,
      current_tree_label: undefined,
      directive: undefined,
      display_title_with_tree_label: undefined,
      filename: undefined,
      finest_tree_label: undefined,
      function: undefined,
      message: undefined,
      origin: undefined,
      stripped_crash: undefined,
      title: undefined,
      type: undefined,
      uri: undefined,
      value: undefined,
    },
    occurrence: null,
    projectID: '',
    size: 0,
    tags: [],
    title: '',
    user: null,
  };

  const projectSlug = eventSlug.split(':')[0];

  return (
    <SentryDocumentTitle
      title="Aggregate Span View"
      orgSlug={organization.slug}
      projectSlug={projectSlug}
    >
      <Layout.Page>
        <NoProjectMessage organization={organization}>
          <TitleWrapper>
            <b>Aggregate Span Tree</b>
          </TitleWrapper>
          <Layout.Main>
            <Layout.Header />
            <Layout.Side />
            <Layout.Body>
              <SpansContainer>
                <DescriptionContainer>
                  This span tree represents a p95 aggregated view of{' '}
                  <b>{location.query.transaction}</b> transactions.
                </DescriptionContainer>
                <Spans
                  event={event}
                  organization={organization}
                  hiddenSpanSubTrees={
                    new Set(
                      flattenedSpans
                        .filter(span => {
                          return span.frequency < 0.3;
                        })
                        .map(span => span.span_id)
                    )
                  }
                />
              </SpansContainer>
            </Layout.Body>
          </Layout.Main>
        </NoProjectMessage>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default AggregateSpans;

const TitleWrapper = styled('div')`
  padding: 0px 30px;
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 20px;
`;

const SpansContainer = styled('div')`
  margin: space(2);
`;

const DescriptionContainer = styled('div')`
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray500};
`;

import styled from '@emotion/styled';

import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import {Spans} from 'sentry/components/events/interfaces/spans';
import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
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
    trace_id: '10ff38656613473bac1675edfe1e17d5', // TODO
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
            <StyledEventOrGroupTitle data={event} />
          </TitleWrapper>
          <Layout.Main>
            <Layout.Header />
            <Layout.Side />
            <Layout.Body>
              <SpansContainer>
                <Spans event={event} organization={organization} />
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
  margin-top: 20px;
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: ${p => p.theme.headerFontSize};
`;

const SpansContainer = styled('div')`
  margin: space(2);
`;

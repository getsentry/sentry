import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {DataSection} from 'sentry/components/events/styles';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getDuration} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

interface SpanDiff {
  duration_after: number;
  duration_before: number;
  duration_delta: number;
  freq_after: number;
  freq_before: number;
  freq_delta: number;
  sample_event_id: string;
  score_delta: number;
  span_description: string;
  span_group: string;
  span_op: string;
}

interface DiffRowProps {
  after: number;
  before: number;
  delta: number;
  end: string;
  group: string;
  label: string;
  op: string;
  projectId: string;
  start: string;
  transaction: string;
}

interface UseFetchAdvancedAnalysisProps {
  breakpoint: string;
  end: string;
  projectId: string;
  start: string;
  transaction: string;
}

function useFetchAdvancedAnalysis({
  transaction,
  start,
  end,
  breakpoint,
  projectId,
}: UseFetchAdvancedAnalysisProps) {
  const organization = useOrganization();
  return useApiQuery<SpanDiff[]>(
    [
      `/organizations/${organization.slug}/events-root-cause-analysis/`,
      {
        query: {
          transaction,
          project: projectId,
          start,
          end,
          breakpoint,
          per_page: 10,
        },
      },
    ],
    {
      staleTime: 60000,
      retry: false,
    }
  );
}

function DiffRow({
  delta,
  label,
  before,
  after,
  op,
  group,
  projectId,
  transaction,
  start,
  end,
}: DiffRowProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();

  const {background, color} =
    delta > 0
      ? {background: theme.red100, color: theme.red300}
      : {background: theme.green100, color: theme.green300};
  const Icon = delta > 0 ? IconAdd : IconSubtract;
  return (
    <Row backgroundColor={background}>
      <IconWrapper color={color}>
        <Icon />
        <span style={{paddingLeft: '8px'}}>{t('Span')}</span>
      </IconWrapper>
      <Label>
        <Tooltip title={label} showOnlyOnOverflow>
          <TextOverflow>
            <Link
              to={spanDetailsRouteWithQuery({
                orgSlug: organization.slug,
                spanSlug: {op, group},
                transaction,
                projectID: projectId,
                query: {
                  ...location.query,
                  statsPeriod: undefined,
                  query: undefined,
                  start,
                  end,
                },
              })}
            >
              {label}
            </Link>
          </TextOverflow>
        </Tooltip>
      </Label>
      <Tooltip
        title={tct(`From [beforeDuration] to [afterDuration]`, {
          beforeDuration: getDuration(before / 1000, 2, undefined, true),
          afterDuration: getDuration(after / 1000, 2, undefined, true),
        })}
        showUnderline
      >
        {delta > 0 ? '+' : ''}
        {delta.toFixed(2)}%
      </Tooltip>
    </Row>
  );
}

function AggregateSpanDiff({event, projectId}) {
  const {transaction, requestStart, requestEnd, breakpoint} =
    event?.occurrence?.evidenceData;

  const start = new Date(requestStart * 1000).toISOString();
  const end = new Date(requestEnd * 1000).toISOString();
  const breakpointTimestamp = new Date(breakpoint * 1000).toISOString();
  const {data, isLoading, isError} = useFetchAdvancedAnalysis({
    transaction,
    start,
    end,
    breakpoint: breakpointTimestamp,
    projectId,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  let content;
  if (isError) {
    content = (
      <EmptyStateWarning>
        <p>{t('Oops! Something went wrong fetching span diffs')}</p>
      </EmptyStateWarning>
    );
  } else if (!defined(data) || data.length === 0) {
    content = (
      <EmptyStateWarning>
        <p>{t('Unable to find significant differences in spans')}</p>
      </EmptyStateWarning>
    );
  } else {
    content = data.map(diff => (
      <DiffRow
        key={`${diff.span_op}:${diff.span_group}`}
        delta={diff.duration_delta * 100}
        before={diff.duration_before}
        after={diff.duration_after}
        label={
          diff.span_description
            ? `${diff.span_op}: ${diff.span_description}`
            : diff.span_op
        }
        op={diff.span_op}
        group={diff.span_group}
        projectId={projectId}
        transaction={transaction}
        start={start}
        end={end}
      />
    ));
  }

  return (
    <DataSection>
      <strong>{t('Frequent Diffs:')}</strong>
      {content}
    </DataSection>
  );
}

export default AggregateSpanDiff;

const Label = styled('div')`
  flex: auto;
  margin: 0 ${space(2)};
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const IconWrapper = styled('div')<{color: string}>`
  display: flex;
  align-items: center;
  color: ${p => p.color};
`;

const Row = styled('div')<{backgroundColor: string}>`
  background: ${p => p.backgroundColor};
  padding: ${space(2)};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

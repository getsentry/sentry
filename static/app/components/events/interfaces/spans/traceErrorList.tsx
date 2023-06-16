import {memo} from 'react';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {tct, tn} from 'sentry/locale';
import {
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';

import {ParsedTraceType, SpanType} from './types';

interface TraceErrorListProps {
  errors: (TraceError | TracePerformanceIssue)[];
  onClickSpan: (event: React.MouseEvent, spanId: SpanType['span_id']) => void;
  trace: ParsedTraceType;
}

function TraceErrorList({trace, errors, onClickSpan}: TraceErrorListProps) {
  return (
    <List symbol="bullet" data-test-id="trace-error-list">
      {flatten(
        Object.entries(groupBy(errors, 'span')).map(([spanId, spanErrors]) => {
          return Object.entries(groupBy(spanErrors, 'level')).map(
            ([level, spanLevelErrors]) => (
              <ListItem key={`${spanId}-${level}`}>
                {tct('[errors] [link]', {
                  errors: tn(
                    '%s %s error in ',
                    '%s %s errors in ',
                    spanLevelErrors.length,
                    level === 'error' ? '' : level // Prevents awkward "error errors" copy if the level is "error"
                  ),
                  link: (
                    <ErrorLink onClick={event => onClickSpan(event, spanId)}>
                      {findSpanById(trace, spanId).op}
                    </ErrorLink>
                  ),
                })}
              </ListItem>
            )
          );
        })
      )}
    </List>
  );
}

const ErrorLink = styled('a')`
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

// Given a span ID, find the associated span. It might be the trace itself
// (which is technically a type of span) or a specific span associated with
// the trace
const findSpanById = (trace: ParsedTraceType, spanId: SpanType['span_id']) => {
  return trace.spans.find(span => span.span_id === spanId && span?.op) || trace;
};

export default memo(TraceErrorList);

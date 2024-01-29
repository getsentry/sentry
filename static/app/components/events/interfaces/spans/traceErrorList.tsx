import {Fragment, memo} from 'react';
import groupBy from 'lodash/groupBy';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {tct, tn} from 'sentry/locale';
import type {
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';

import type {ParsedTraceType, SpanType} from './types';

interface TraceErrorListProps {
  errors: TraceError[];
  trace: ParsedTraceType;
  performanceIssues?: TracePerformanceIssue[];
}

function TraceErrorList({trace, errors, performanceIssues}: TraceErrorListProps) {
  return (
    <List symbol="bullet" data-test-id="trace-error-list">
      <Fragment>
        {Object.entries(groupBy(errors, 'span')).flatMap(([spanId, spanErrors]) => {
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
                  link: findSpanById(trace, spanId).op,
                })}
              </ListItem>
            )
          );
        })}
        {Object.entries(groupBy(performanceIssues, 'span')).flatMap(
          ([spanId, spanErrors]) => (
            <ListItem key={`${spanId}`}>
              {tct('[errors] [link]', {
                errors: tn(
                  '%s performance issue in ',
                  '%s performance issues in ',
                  spanErrors.length
                ),
                link: findSpanById(trace, spanId).op,
              })}
            </ListItem>
          )
        )}
      </Fragment>
    </List>
  );
}

// Given a span ID, find the associated span. It might be the trace itself
// (which is technically a type of span) or a specific span associated with
// the trace
const findSpanById = (trace: ParsedTraceType, spanId: SpanType['span_id']) => {
  return trace.spans.find(span => span.span_id === spanId && span?.op) || trace;
};

export default memo(TraceErrorList);

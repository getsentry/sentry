import {Fragment} from 'react';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tn} from 'sentry/locale';
import {TraceError} from 'sentry/utils/performance/quickTrace/types';

import {ParsedTraceType, SpanType} from './types';

interface TraceErrorListProps {
  errors: TraceError[];
  onClickSpan: (event: React.MouseEvent, spanId: SpanType['span_id']) => void;
  trace: ParsedTraceType;
}

function TraceErrorList({trace, errors, onClickSpan}: TraceErrorListProps) {
  return (
    <List symbol="bullet" data-test-id="trace-error-list">
      {flatten(
        Object.entries(groupBy(errors, 'span')).map(([spanId, spanErrors]) => {
          const span = findSpanById(trace, spanId);

          return Object.entries(groupBy(spanErrors, 'level')).map(
            ([level, spanLevelErrors]) => (
              <ListItem key={`${spanId}-${level}`}>
                {t('%d', spanLevelErrors.length)} {` ${level === 'error' ? '' : level} `}
                {tn('error', 'errors', spanLevelErrors.length)}
                {span ? (
                  <Fragment>
                    {t(' in ')}
                    <ErrorLink onClick={event => onClickSpan(event, spanId)}>
                      {span.op}
                    </ErrorLink>
                  </Fragment>
                ) : null}
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

export default React.memo(TraceErrorList);

import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {MetricsResponse, SpanMetricsField} from 'sentry/views/starfish/types';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

type Props = {
  span: Pick<
    MetricsResponse,
    SpanMetricsField.SPAN_OP | SpanMetricsField.SPAN_DESCRIPTION
  >;
};

export function SpanDescription({span}: Props) {
  if (span[SpanMetricsField.SPAN_OP]?.startsWith('db')) {
    return <DatabaseSpanDescription span={span} />;
  }

  return <WordBreak>{span[SpanMetricsField.SPAN_DESCRIPTION]}</WordBreak>;
}

function DatabaseSpanDescription({span}: Props) {
  const formatter = new SQLishFormatter();

  return (
    <CodeSnippet language="sql">
      {formatter.toString(span[SpanMetricsField.SPAN_DESCRIPTION])}
    </CodeSnippet>
  );
}

const WordBreak = styled('div')`
  word-break: break-word;
`;

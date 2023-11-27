import React from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {StackTraceMiniFrame} from 'sentry/views/starfish/components/stackTraceMiniFrame';
import {MetricsResponse, SpanMetricsField} from 'sentry/views/starfish/types';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

type Props = {
  span: Pick<
    MetricsResponse,
    SpanMetricsField.SPAN_OP | SpanMetricsField.SPAN_DESCRIPTION
  > & {
    data: {
      'code.filepath': string;
      'code.function': string;
      'code.lineno': number;
    };
  };
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
    <React.Fragment>
      <CodeSnippet language="sql">
        {formatter.toString(span[SpanMetricsField.SPAN_DESCRIPTION])}
      </CodeSnippet>

      {/* TODO: Feature flag gate */}
      {span?.data?.['code.filepath'] && (
        <StackTraceMiniFrame
          frame={{
            absPath: span?.data?.['code.filepath'],
            lineNo: span?.data?.['code.lineno'],
            function: span?.data?.['code.function'],
          }}
        />
      )}
    </React.Fragment>
  );
}

const WordBreak = styled('div')`
  word-break: break-word;
`;

import {useMemo} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {StackTraceMiniFrame} from 'sentry/views/starfish/components/stackTraceMiniFrame';
import {MetricsResponse, SpanMetricsField} from 'sentry/views/starfish/types';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

type Props = {
  span: Pick<
    MetricsResponse,
    SpanMetricsField.SPAN_OP | SpanMetricsField.SPAN_DESCRIPTION
  > & {
    project_id?: number;
    'transaction.id'?: string;
  } & {
    data?: {
      'code.filepath'?: string;
      'code.function'?: string;
      'code.lineno'?: number;
    };
  };
};

export function SpanDescription({span}: Props) {
  if (span[SpanMetricsField.SPAN_OP]?.startsWith('db')) {
    return <DatabaseSpanDescription span={span} />;
  }

  return <WordBreak>{span[SpanMetricsField.SPAN_DESCRIPTION]}</WordBreak>;
}

const formatter = new SQLishFormatter();

function DatabaseSpanDescription({span}: Props) {
  const rawDescription = span[SpanMetricsField.SPAN_DESCRIPTION];
  const formatterDescription = useMemo(() => {
    return formatter.toString(rawDescription);
  }, [rawDescription]);

  return (
    <Frame>
      <CodeSnippet language="sql" isRounded={false}>
        {formatterDescription}
      </CodeSnippet>

      <Feature features={['organizations:performance-database-view-query-source']}>
        {span?.data?.['code.filepath'] && (
          <StackTraceMiniFrame
            projectId={span.project_id?.toString()}
            eventId={span['transaction.id']}
            frame={{
              filename: span?.data?.['code.filepath'],
              lineNo: span?.data?.['code.lineno'],
              function: span?.data?.['code.function'],
            }}
          />
        )}
      </Feature>
    </Frame>
  );
}

const Frame = styled('div')`
  border: solid 1px ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const WordBreak = styled('div')`
  word-break: break-word;
`;

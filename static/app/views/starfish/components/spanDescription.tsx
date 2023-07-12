import styled from '@emotion/styled';

import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {highlightSql} from 'sentry/views/starfish/utils/highlightSql';

const {SPAN_DESCRIPTION, SPAN_ACTION, SPAN_DOMAIN} = SpanMetricsFields;

type SpanMeta = {
  'span.action': string;
  'span.description': string;
  'span.domain': string;
  'span.op': string;
};

export function SpanDescription({spanMeta}: {spanMeta: SpanMeta}) {
  if (spanMeta['span.op'].startsWith('db')) {
    return <DatabaseSpanDescription spanMeta={spanMeta} />;
  }

  return <DescriptionWrapper>{spanMeta[SPAN_DESCRIPTION]}</DescriptionWrapper>;
}

function DatabaseSpanDescription({spanMeta}: {spanMeta: SpanMeta}) {
  return (
    <CodeWrapper>
      <FormattedCode>
        {highlightSql(spanMeta[SPAN_DESCRIPTION] || '', {
          action: spanMeta[SPAN_ACTION] || '',
          domain: spanMeta[SPAN_DOMAIN] || '',
        })}
      </FormattedCode>
    </CodeWrapper>
  );
}

const CodeWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const DescriptionWrapper = styled('div')`
  word-break: break-word;
`;

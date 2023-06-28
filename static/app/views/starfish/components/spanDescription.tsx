import styled from '@emotion/styled';

import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import {highlightSql} from 'sentry/views/starfish/utils/highlightSql';

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

  return <DescriptionWrapper>{spanMeta['span.description']}</DescriptionWrapper>;
}

function DatabaseSpanDescription({spanMeta}: {spanMeta: SpanMeta}) {
  return (
    <CodeWrapper>
      <FormattedCode>
        {highlightSql(spanMeta['span.description'] || '', {
          action: spanMeta['span.action'] || '',
          domain: spanMeta['span.domain'] || '',
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

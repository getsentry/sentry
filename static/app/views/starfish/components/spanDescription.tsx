import styled from '@emotion/styled';

import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {highlightSql} from 'sentry/views/starfish/utils/highlightSql';

export function SpanDescription({span}: {span: IndexedSpan}) {
  if (span.op.startsWith('db')) {
    return <DatabaseSpanDescription span={span} />;
  }

  return <div>{span.description}</div>;
}

function DatabaseSpanDescription({span}: {span: IndexedSpan}) {
  return (
    <CodeWrapper>
      <FormattedCode>
        {highlightSql(span.description || '', {
          action: span.action || '',
          domain: span.domain || '',
        })}
      </FormattedCode>
    </CodeWrapper>
  );
}

const CodeWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

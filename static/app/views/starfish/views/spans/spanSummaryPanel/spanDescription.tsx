import styled from '@emotion/styled';

import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import {highlightSql} from 'sentry/views/starfish/modules/databaseModule/panel';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';

export function SpanDescription({span}: {span: Span}) {
  if (span.span_operation.startsWith('db')) {
    return <DatabaseSpanDescription span={span} />;
  }

  return <div>{span.description}</div>;
}

function DatabaseSpanDescription({span}: {span: Span}) {
  return (
    <CodeWrapper>
      <FormattedCode>
        {highlightSql(span.formatted_desc || span.description || '', {
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

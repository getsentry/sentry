import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {useFullSpanFromTrace} from 'sentry/views/insights/common/queries/useFullSpanFromTrace';
import {ModuleName} from 'sentry/views/insights/types';

const formatter = new SQLishFormatter();

const INDEXED_SPAN_SORT = {
  field: 'span.self_time',
  kind: 'desc' as const,
};

interface Props {
  moduleName: ModuleName;
  filters?: Record<string, string>;
  group?: string;
  shortDescription?: string;
}

export function FullSpanDescription({
  group,
  shortDescription,
  filters,
  moduleName,
}: Props) {
  const {
    data: fullSpan,
    isLoading,
    isFetching,
  } = useFullSpanFromTrace(group, [INDEXED_SPAN_SORT], Boolean(group), filters);

  const description = fullSpan?.description ?? shortDescription;
  const system = fullSpan?.data?.['db.system'];

  if (isLoading && isFetching) {
    return (
      <PaddedSpinner>
        <LoadingIndicator mini hideMessage relative />
      </PaddedSpinner>
    );
  }

  if (!description) {
    return null;
  }

  if (moduleName === ModuleName.DB) {
    if (system === 'mongodb') {
      return (
        <CodeSnippet language="json">
          {JSON.stringify(
            JSON.parse(fullSpan?.sentry_tags?.description ?? fullSpan?.description ?? ''),
            null,
            4
          ) ?? ''}
        </CodeSnippet>
      );
    }

    return (
      <CodeSnippet language="sql">
        {formatter.toString(description, {maxLineLength: LINE_LENGTH})}
      </CodeSnippet>
    );
  }

  if (moduleName === ModuleName.RESOURCE) {
    return <CodeSnippet language="http">{description}</CodeSnippet>;
  }

  return <Fragment>{description}</Fragment>;
}

const LINE_LENGTH = 60;

const PaddedSpinner = styled('div')`
  padding: 0 ${space(0.5)};
`;

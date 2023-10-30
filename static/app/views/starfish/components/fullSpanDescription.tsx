import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {useFullSpanFromTrace} from 'sentry/views/starfish/queries/useFullSpanFromTrace';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

const formatter = new SQLishFormatter();

export function FullSpanDescription({group, shortDescription, language}: Props) {
  const {
    data: fullSpan,
    isLoading,
    isFetching,
  } = useFullSpanFromTrace(group, Boolean(group));

  const description = fullSpan?.description ?? shortDescription;

  if (!description) {
    return null;
  }

  if (isLoading && isFetching) {
    return (
      <PaddedSpinner>
        <LoadingIndicator mini hideMessage relative />
      </PaddedSpinner>
    );
  }

  if (language === 'sql') {
    return (
      <CodeSnippet language={language}>
        {formatter.toString(description, {maxLineLength: LINE_LENGTH})}
      </CodeSnippet>
    );
  }

  if (language) {
    return <CodeSnippet language={language}>{description}</CodeSnippet>;
  }

  return <Fragment>{description}</Fragment>;
}

interface Props {
  group?: string;
  language?: 'sql' | 'http';
  shortDescription?: string;
}

const LINE_LENGTH = 60;

const PaddedSpinner = styled('div')`
  padding: ${space(0)} ${space(0.5)};
`;

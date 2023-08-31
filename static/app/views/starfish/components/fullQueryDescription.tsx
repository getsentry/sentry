import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {useFullSpanFromTrace} from 'sentry/views/starfish/queries/useFullSpanFromTrace';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

const formatter = new SQLishFormatter();

interface Props {
  group?: string;
  shortDescription?: string;
}

export function FullQueryDescription({group, shortDescription}: Props) {
  const {
    data: fullSpan,
    isLoading,
    isFetching,
  } = useFullSpanFromTrace(group, Boolean(group));

  const description = fullSpan?.description ?? shortDescription;

  if (!description) {
    return null;
  }

  return isLoading && isFetching ? (
    <PaddedSpinner>
      <LoadingIndicator mini hideMessage relative />
    </PaddedSpinner>
  ) : (
    <CodeSnippet language="sql">{formatter.toString(description)}</CodeSnippet>
  );
}

const PaddedSpinner = styled('div')`
  padding: ${space(0)} ${space(0.5)};
`;

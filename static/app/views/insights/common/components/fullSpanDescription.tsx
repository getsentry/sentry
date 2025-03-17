import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {useFullSpanFromTrace} from 'sentry/views/insights/common/queries/useFullSpanFromTrace';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {prettyPrintJsonString} from 'sentry/views/insights/database/utils/jsonUtils';
import {ModuleName, SpanIndexedField} from 'sentry/views/insights/types';

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
  const {data: indexedSpans, isFetching: areIndexedSpansLoading} = useSpansIndexed(
    {
      search: MutableSearch.fromQueryObject({'span.group': group}),
      limit: 1,
      fields: [
        SpanIndexedField.PROJECT_ID,
        SpanIndexedField.TRANSACTION_ID,
        SpanIndexedField.SPAN_DESCRIPTION,
      ],
    },
    'api.starfish.span-description'
  );
  const indexedSpan = indexedSpans?.[0];

  // This is used as backup in case we don't have the necessary data available in the indexed span
  const {
    data: fullSpan,
    isLoading,
    isFetching,
  } = useFullSpanFromTrace(group, [INDEXED_SPAN_SORT], Boolean(indexedSpan), filters);

  const description =
    indexedSpan?.['span.description'] ?? fullSpan?.description ?? shortDescription;
  const system = fullSpan?.data?.['db.system'];

  if (areIndexedSpansLoading || (isLoading && isFetching)) {
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
      let stringifiedQuery = '';
      let result: ReturnType<typeof prettyPrintJsonString> | undefined = undefined;

      if (indexedSpan?.['span.description']) {
        result = prettyPrintJsonString(indexedSpan?.['span.description']);
      } else if (description) {
        result = prettyPrintJsonString(description);
      } else if (fullSpan?.sentry_tags?.description) {
        result = prettyPrintJsonString(fullSpan?.sentry_tags.description);
      } else {
        stringifiedQuery = description || fullSpan?.sentry_tags?.description || 'N/A';
      }

      if (result) {
        stringifiedQuery = result.prettifiedQuery;
      }

      return (
        <QueryClippedBox group={group}>
          <CodeSnippet language="json">{stringifiedQuery}</CodeSnippet>
        </QueryClippedBox>
      );
    }

    return (
      <QueryClippedBox group={group}>
        <CodeSnippet language="sql">
          {formatter.toString(description, {maxLineLength: LINE_LENGTH})}
        </CodeSnippet>
      </QueryClippedBox>
    );
  }

  if (moduleName === ModuleName.RESOURCE) {
    return <CodeSnippet language="http">{description}</CodeSnippet>;
  }

  return <Fragment>{description}</Fragment>;
}

type TruncatedQueryClipBoxProps = {
  children: ReactNode;
  group: string | undefined;
};

function QueryClippedBox({group, children}: TruncatedQueryClipBoxProps) {
  const navigate = useNavigate();
  const databaseURL = useModuleURL(ModuleName.DB);
  const location = useLocation();

  return (
    <StyledClippedBox
      btnText={t('View full query')}
      clipHeight={500}
      buttonProps={{
        icon: <IconOpen />,
        onClick: () =>
          navigate({
            pathname: `${databaseURL}/spans/span/${group}`,
            query: {...location.query, isExpanded: true},
          }),
      }}
    >
      {children}
    </StyledClippedBox>
  );
}

const LINE_LENGTH = 60;

const PaddedSpinner = styled('div')`
  padding: 0 ${space(0.5)};
`;

const StyledClippedBox = styled(ClippedBox)`
  > div > div {
    z-index: 1;
  }
`;

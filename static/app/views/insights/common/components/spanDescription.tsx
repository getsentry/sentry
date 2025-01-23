import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {useFullSpanFromTrace} from 'sentry/views/insights/common/queries/useFullSpanFromTrace';
import {
  MissingFrame,
  StackTraceMiniFrame,
} from 'sentry/views/insights/database/components/stackTraceMiniFrame';
import {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';
import {
  isValidJson,
  prettyPrintJsonString,
} from 'sentry/views/insights/database/utils/jsonUtils';
import type {SpanIndexedFieldTypes} from 'sentry/views/insights/types';
import {SpanIndexedField} from 'sentry/views/insights/types';

interface Props {
  groupId: SpanIndexedFieldTypes[SpanIndexedField.SPAN_GROUP];
  op: SpanIndexedFieldTypes[SpanIndexedField.SPAN_OP];
  preliminaryDescription?: string;
}

export function SpanDescription(props: Props) {
  const {op, preliminaryDescription} = props;

  if (op.startsWith('db')) {
    return <DatabaseSpanDescription {...props} />;
  }

  return <WordBreak>{preliminaryDescription ?? ''}</WordBreak>;
}

const formatter = new SQLishFormatter();

export function DatabaseSpanDescription({
  groupId,
  preliminaryDescription,
}: Omit<Props, 'op'>) {
  const navigate = useNavigate();
  const location = useLocation();

  const {data: indexedSpans, isFetching: areIndexedSpansLoading} = useSpansIndexed(
    {
      search: MutableSearch.fromQueryObject({'span.group': groupId}),
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

  // NOTE: We only need this for `span.data`! If this info existed in indexed spans, we could skip it
  const {data: rawSpan, isFetching: isRawSpanLoading} = useFullSpanFromTrace(
    groupId,
    [INDEXED_SPAN_SORT],
    Boolean(indexedSpan)
  );

  // isExpanded is a query param that is meant to be accessed only when clicking on the
  // "View full query" button from the hover tooltip. It is removed from the query params
  // on the initial load so the value is not persisted through the link
  const [isExpanded] = useState<boolean>(() => Boolean(location.query.isExpanded));
  useEffect(() => {
    navigate(
      {...location, query: {...location.query, isExpanded: undefined}},
      {replace: true}
    );
    // Skip the `location` dependency because it will cause this effect to trigger infinitely, since
    // `navigate` will update the location within this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const system = rawSpan?.data?.['db.system'];

  const formattedDescription = useMemo(() => {
    const rawDescription =
      rawSpan?.description || indexedSpan?.['span.description'] || preliminaryDescription;

    if (system === SupportedDatabaseSystem.MONGODB) {
      let bestDescription = '';

      if (
        rawSpan?.sentry_tags?.description &&
        isValidJson(rawSpan.sentry_tags.description)
      ) {
        bestDescription = rawSpan.sentry_tags.description;
      } else if (preliminaryDescription && isValidJson(preliminaryDescription)) {
        bestDescription = preliminaryDescription;
      } else if (
        indexedSpan?.['span.description'] &&
        isValidJson(indexedSpan?.['span.description'])
      ) {
        bestDescription = indexedSpan?.['span.description'];
      } else if (rawSpan?.description && isValidJson(rawSpan.description)) {
        bestDescription = rawSpan?.description;
      } else {
        return rawDescription ?? 'N/A';
      }

      return prettyPrintJsonString(bestDescription).prettifiedQuery;
    }

    return formatter.toString(rawDescription ?? '');
  }, [preliminaryDescription, rawSpan, indexedSpan, system]);

  return (
    <Frame>
      {areIndexedSpansLoading || isRawSpanLoading ? (
        <WithPadding>
          <LoadingIndicator mini />
        </WithPadding>
      ) : (
        <QueryClippedBox clipHeight={500} isExpanded={isExpanded}>
          <CodeSnippet language={system === 'mongodb' ? 'json' : 'sql'} isRounded={false}>
            {formattedDescription ?? ''}
          </CodeSnippet>
        </QueryClippedBox>
      )}

      {!areIndexedSpansLoading && !isRawSpanLoading && (
        <Fragment>
          {rawSpan?.data?.['code.filepath'] ? (
            <StackTraceMiniFrame
              projectId={indexedSpan?.project_id?.toString()}
              eventId={indexedSpan?.['transaction.id']}
              frame={{
                filename: rawSpan?.data?.['code.filepath'],
                lineNo: rawSpan?.data?.['code.lineno'],
                function: rawSpan?.data?.['code.function'],
              }}
            />
          ) : (
            <MissingFrame system={system} />
          )}
        </Fragment>
      )}
    </Frame>
  );
}

function QueryClippedBox(props: any) {
  const {isExpanded, children} = props;

  if (isExpanded) {
    return children;
  }

  return <StyledClippedBox {...props} />;
}

const INDEXED_SPAN_SORT = {
  field: 'span.self_time',
  kind: 'desc' as const,
};

export const Frame = styled('div')`
  border: solid 1px ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const WithPadding = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
`;

const WordBreak = styled('div')`
  word-break: break-word;
`;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;

  > div > div {
    z-index: 1;
  }
`;

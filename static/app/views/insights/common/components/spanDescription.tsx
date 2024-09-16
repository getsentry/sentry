import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {useFullSpanFromTrace} from 'sentry/views/insights/common/queries/useFullSpanFromTrace';
import {
  MissingFrame,
  StackTraceMiniFrame,
} from 'sentry/views/insights/database/components/stackTraceMiniFrame';
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

  const system = rawSpan?.data?.['db.system'];

  const formattedDescription = useMemo(() => {
    const rawDescription =
      rawSpan?.description || indexedSpan?.['span.description'] || preliminaryDescription;

    if (preliminaryDescription && isNoSQLQuery(preliminaryDescription)) {
      return formatJsonQuery(preliminaryDescription);
    }

    if (rawSpan?.description && isNoSQLQuery(rawSpan?.description)) {
      return formatJsonQuery(rawSpan?.description);
    }

    return formatter.toString(rawDescription ?? '');
  }, [preliminaryDescription, rawSpan, indexedSpan]);

  return (
    <Frame>
      {areIndexedSpansLoading || !preliminaryDescription ? (
        <WithPadding>
          <LoadingIndicator mini />
        </WithPadding>
      ) : (
        <CodeSnippet language={system === 'mongodb' ? 'json' : 'sql'} isRounded={false}>
          {formattedDescription ?? ''}
        </CodeSnippet>
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

// TODO: We should transform the data a bit for mongodb queries.
// For example, it would be better if we display the operation on the collection as the
// first key value pair in the JSON, since this is not guaranteed by the backend
export function formatJsonQuery(queryString: string) {
  try {
    return JSON.stringify(JSON.parse(queryString), null, 4);
  } catch (error) {
    throw Error(`Failed to parse JSON: ${queryString}`);
  }
}

function isNoSQLQuery(queryString?: string, system?: string) {
  if (system && system === 'mongodb') {
    return true;
  }

  // If the system isn't provided, we can at least infer that it is valid JSON if it is enclosed in parentheses
  if (queryString?.startsWith('{') && queryString.endsWith('}')) {
    return true;
  }

  return false;
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

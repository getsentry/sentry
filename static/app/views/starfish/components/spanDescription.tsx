import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {
  MissingFrame,
  StackTraceMiniFrame,
} from 'sentry/views/starfish/components/stackTraceMiniFrame';
import {useFullSpanFromTrace} from 'sentry/views/starfish/queries/useFullSpanFromTrace';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import type {SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {SpanIndexedField} from 'sentry/views/starfish/types';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

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
  // TODO: we're using all SpanIndexedFields here, but maybe we should only use what we need?
  // Truncate to 20 fields otherwise discover will complain.
  const fields = Object.values(SpanIndexedField);

  const {data: indexedSpans, isFetching: areIndexedSpansLoading} = useIndexedSpans({
    filters: {'span.group': groupId},
    sorts: [INDEXED_SPAN_SORT],
    limit: 1,
    fields,
    referrer: 'api.starfish.span-description',
  });
  const indexedSpan = indexedSpans?.[0];

  // NOTE: We only need this for `span.data`! If this info existed in indexed spans, we could skip it
  const {data: rawSpan, isFetching: isRawSpanLoading} = useFullSpanFromTrace(
    groupId,
    [INDEXED_SPAN_SORT],
    Boolean(indexedSpan)
  );

  const rawDescription =
    rawSpan?.description || indexedSpan?.['span.description'] || preliminaryDescription;

  const formatterDescription = useMemo(() => {
    return formatter.toString(rawDescription ?? '');
  }, [rawDescription]);

  return (
    <Frame>
      {areIndexedSpansLoading ? (
        <WithPadding>
          <LoadingIndicator mini />
        </WithPadding>
      ) : (
        <CodeSnippet language="sql" isRounded={false}>
          {formatterDescription}
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
            <MissingFrame />
          )}
        </Fragment>
      )}
    </Frame>
  );
}

const INDEXED_SPAN_SORT = {
  field: 'span.self_time',
  kind: 'desc' as const,
};

const Frame = styled('div')`
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

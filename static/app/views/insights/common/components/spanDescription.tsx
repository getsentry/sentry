import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {CodeBlock} from 'sentry/components/core/code';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRelease} from 'sentry/utils/useRelease';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  MissingFrame,
  StackTraceMiniFrame,
} from 'sentry/views/insights/database/components/stackTraceMiniFrame';
import {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';
import {
  isValidJson,
  prettyPrintJsonString,
} from 'sentry/views/insights/database/utils/jsonUtils';
import type {SpanResponse} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

interface Props {
  groupId: SpanResponse[SpanFields.SPAN_GROUP];
  op: SpanResponse[SpanFields.SPAN_OP];
  preliminaryDescription?: string;
  shouldClipHeight?: boolean;
  showBorder?: boolean;
}

const formatter = new SQLishFormatter();

export function DatabaseSpanDescription({
  groupId,
  preliminaryDescription,
  showBorder = true,
  shouldClipHeight = true,
}: Omit<Props, 'op'>) {
  const navigate = useNavigate();
  const location = useLocation();
  const {projects} = useProjects();
  const organization = useOrganization();

  const {data: indexedSpans, isFetching: areIndexedSpansLoading} = useSpans(
    {
      search: MutableSearch.fromQueryObject({'span.group': groupId}),
      limit: 1,
      fields: [
        SpanFields.PROJECT_ID,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.DB_SYSTEM,
        SpanFields.CODE_FILEPATH,
        SpanFields.CODE_LINENO,
        SpanFields.CODE_FUNCTION,
        SpanFields.SDK_NAME,
        SpanFields.SDK_VERSION,
        SpanFields.RELEASE,
        SpanFields.PLATFORM,
      ],
      sorts: [{field: SpanFields.CODE_FILEPATH, kind: 'desc'}],
    },
    'api.insights.span-description'
  );
  const indexedSpan = indexedSpans?.[0];

  const project = projects.find(p => p.id === indexedSpan?.['project.id']?.toString());

  const {data: release} = useRelease({
    orgSlug: organization.slug,
    projectSlug: project?.slug ?? '',
    releaseVersion: indexedSpan?.release ?? '',
    enabled: indexedSpan?.release !== undefined,
  });

  const sdk =
    indexedSpan?.['sdk.name'] && indexedSpan?.['sdk.version']
      ? {
          name: indexedSpan?.['sdk.name'],
          version: indexedSpan?.['sdk.version'],
        }
      : undefined;

  const event = {
    platform: indexedSpan?.platform,
    release,
    sdk,
  };

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

  const system = indexedSpan?.['db.system'];
  const codeFilepath = indexedSpan?.['code.filepath'];
  const codeLineno = indexedSpan?.['code.lineno'];
  const codeFunction = indexedSpan?.['code.function'];

  const formattedDescription = useMemo(() => {
    const rawDescription = indexedSpan?.['span.description'] || preliminaryDescription;

    if (system === SupportedDatabaseSystem.MONGODB) {
      let bestDescription = '';

      if (preliminaryDescription && isValidJson(preliminaryDescription)) {
        bestDescription = preliminaryDescription;
      } else if (
        indexedSpan?.['span.description'] &&
        isValidJson(indexedSpan?.['span.description'])
      ) {
        bestDescription = indexedSpan?.['span.description'];
      } else {
        return rawDescription ?? 'N/A';
      }

      return prettyPrintJsonString(bestDescription).prettifiedQuery;
    }

    return formatter.toString(rawDescription ?? '');
  }, [preliminaryDescription, indexedSpan, system]);

  return (
    <Frame showBorder={showBorder}>
      {areIndexedSpansLoading ? (
        <WithPadding>
          <LoadingIndicator mini />
        </WithPadding>
      ) : (
        <QueryWrapper
          clipHeight={500}
          isExpanded={isExpanded}
          shouldClipHeight={shouldClipHeight}
        >
          <CodeBlock language={system === 'mongodb' ? 'json' : 'sql'} isRounded={false}>
            {formattedDescription ?? ''}
          </CodeBlock>
        </QueryWrapper>
      )}

      {!areIndexedSpansLoading && (
        <Fragment>
          {codeFilepath ? (
            <StackTraceMiniFrame
              projectId={indexedSpan?.['project.id']?.toString()}
              event={event}
              frame={{
                filename: codeFilepath,
                lineNo: codeLineno,
                function: codeFunction,
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

function QueryWrapper(props: any) {
  const {isExpanded, children, shouldClipHeight} = props;

  if (!shouldClipHeight) {
    return <StyledFullBox>{children}</StyledFullBox>;
  }

  if (isExpanded) {
    return children;
  }
  return <StyledClippedBox {...props} />;
}

const Frame = styled('div')<{showBorder: boolean}>`
  display: flex;
  flex-direction: column;
  height: 100%;
  border: ${p => (p.showBorder ? `solid 1px ${p.theme.tokens.border.primary}` : 'none')};
  border-radius: ${p => (p.showBorder ? p.theme.radius.md : '0')};
  overflow: hidden;
`;

const WithPadding = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
`;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;

  > div > div {
    z-index: 1;
  }
`;

const StyledFullBox = styled('div')`
  padding: 0;
  height: 100%;
  overflow-y: auto;
`;

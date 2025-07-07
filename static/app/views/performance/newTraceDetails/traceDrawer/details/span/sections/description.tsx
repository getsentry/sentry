import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Link} from 'sentry/components/core/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LinkHint from 'sentry/components/structuredEventData/linkHint';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {getHighlightedSpanAttributes} from 'sentry/views/insights/agentMonitoring/utils/highlightedSpanAttributes';
import ResourceSize from 'sentry/views/insights/browser/resources/components/resourceSize';
import {
  DisabledImages,
  LOCAL_STORAGE_SHOW_LINKS,
  MissingImage,
} from 'sentry/views/insights/browser/resources/components/sampleImages';
import {useEventDetails} from 'sentry/views/insights/common/queries/useEventDetails';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {
  MissingFrame,
  StackTraceMiniFrame,
} from 'sentry/views/insights/database/components/stackTraceMiniFrame';
import {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';
import {
  isValidJson,
  prettyPrintJsonString,
} from 'sentry/views/insights/database/utils/jsonUtils';
import {ModuleName, SpanIndexedField} from 'sentry/views/insights/types';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import SpanSummaryLink from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/components/spanSummaryLink';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {usePerformanceGeneralProjectSettings} from 'sentry/views/performance/utils';

const formatter = new SQLishFormatter();

export function SpanDescription({
  node,
  organization,
  location,
  project,
  hideNodeActions,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
  project: Project | undefined;
  hideNodeActions?: boolean;
}) {
  const {data: event} = useEventDetails({
    eventId: node.event?.eventID,
    projectSlug: project?.slug,
  });
  const span = node.value;
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const resolvedModule: ModuleName = resolveSpanModule(
    span.sentry_tags?.op,
    span.sentry_tags?.category
  );

  const system = span?.data?.['db.system'];
  const formattedDescription = useMemo(() => {
    if (resolvedModule !== ModuleName.DB) {
      return span.description ?? '';
    }

    if (
      system === SupportedDatabaseSystem.MONGODB &&
      span?.sentry_tags?.description &&
      isValidJson(span.sentry_tags.description)
    ) {
      return prettyPrintJsonString(span.sentry_tags.description).prettifiedQuery;
    }

    return formatter.toString(span.description ?? '');
  }, [span.description, resolvedModule, span.sentry_tags?.description, system]);

  const hasNewSpansUIFlag =
    organization.features.includes('performance-spans-new-ui') &&
    organization.features.includes('insights-initial-modules');

  // The new spans UI relies on the group hash assigned by Relay, which is different from the hash available on the span itself
  const groupHash = hasNewSpansUIFlag
    ? (span.sentry_tags?.group ?? '')
    : (span.hash ?? '');
  const showAction = hasExploreEnabled ? !!span.description : !!span.op && !!span.hash;
  const averageSpanDuration: number | undefined =
    span['span.averageResults']?.['avg(span.duration)'];

  const actions = showAction ? (
    <BodyContentWrapper
      padding={
        resolvedModule === ModuleName.DB ? `${space(1)} ${space(2)}` : `${space(1)}`
      }
    >
      <SpanSummaryLink
        op={span.op}
        category={span.sentry_tags?.category}
        group={groupHash}
        project_id={node.event?.projectID}
        organization={organization}
      />
      <Link
        to={
          hasExploreEnabled
            ? getSearchInExploreTarget(
                organization,
                location,
                node.event?.projectID,
                SpanIndexedField.SPAN_DESCRIPTION,
                span.description!,
                TraceDrawerActionKind.INCLUDE
              )
            : spanDetailsRouteWithQuery({
                organization,
                transaction: node.event?.title ?? '',
                query: location.query,
                spanSlug: {op: span.op!, group: groupHash},
                projectID: node.event?.projectID,
              })
        }
        onClick={() => {
          if (hasExploreEnabled) {
            traceAnalytics.trackExploreSearch(
              organization,
              SpanIndexedField.SPAN_DESCRIPTION,
              span.description!,
              TraceDrawerActionKind.INCLUDE,
              'drawer'
            );
          } else if (hasNewSpansUIFlag) {
            trackAnalytics('trace.trace_layout.view_span_summary', {
              organization,
              module: resolvedModule,
            });
          } else {
            trackAnalytics('trace.trace_layout.view_similar_spans', {
              organization,
              module: resolvedModule,
              source: 'span_description',
            });
          }
        }}
      >
        <StyledIconGraph type="scatter" size="xs" />
        {hasNewSpansUIFlag || hasExploreEnabled
          ? t('More Samples')
          : t('View Similar Spans')}
      </Link>
    </BodyContentWrapper>
  ) : null;

  const value =
    resolvedModule === ModuleName.DB ? (
      <CodeSnippetWrapper>
        <StyledCodeSnippet
          language={system === 'mongodb' ? 'json' : 'sql'}
          isRounded={false}
        >
          {formattedDescription}
        </StyledCodeSnippet>
        {span?.data?.['code.filepath'] ? (
          <StackTraceMiniFrame
            projectId={node.event?.projectID}
            event={event}
            frame={{
              filename: span?.data?.['code.filepath'],
              lineNo: span?.data?.['code.lineno'],
              function: span?.data?.['code.function'],
            }}
          />
        ) : (
          <MissingFrame />
        )}
      </CodeSnippetWrapper>
    ) : hasNewSpansUIFlag &&
      resolvedModule === ModuleName.RESOURCE &&
      span.op === 'resource.img' ? (
      <ResourceImageDescription formattedDescription={formattedDescription} node={node} />
    ) : (
      <DescriptionWrapper>
        {formattedDescription ? (
          <Fragment>
            <span>
              {formattedDescription}
              <LinkHint value={formattedDescription} />
            </span>
            <CopyToClipboardButton
              borderless
              size="zero"
              iconSize="xs"
              text={formattedDescription}
              tooltipProps={{disabled: true}}
            />
          </Fragment>
        ) : (
          t('This span has no description')
        )}
      </DescriptionWrapper>
    );

  return (
    <TraceDrawerComponents.Highlights
      node={node}
      transaction={undefined}
      project={project}
      avgDuration={averageSpanDuration ? averageSpanDuration / 1000 : undefined}
      headerContent={value}
      bodyContent={actions}
      hideNodeActions={hideNodeActions}
      highlightedAttributes={getHighlightedSpanAttributes({
        organization,
        attributes: span.data,
        op: span.op,
      })}
    />
  );
}

function getImageSrc(span: TraceTree.Span) {
  let src = span.description ?? '';

  // Account for relative URLs
  if (src.startsWith('/')) {
    const urlScheme = span.data?.['url.scheme'];
    const serverAddress = span.data?.['server.address'];

    if (urlScheme && serverAddress) {
      src = `${urlScheme}://${serverAddress}${src}`;
    }
  }

  return src;
}

function ResourceImageDescription({
  formattedDescription,
  node,
}: {
  formattedDescription: string;
  node: TraceTreeNode<TraceTree.Span>;
}) {
  const projectID = node.event?.projectID ? Number(node.event?.projectID) : undefined;
  const span = node.value;

  const {data: settings, isPending: isSettingsLoading} =
    usePerformanceGeneralProjectSettings(Number(projectID));
  const isImagesEnabled = settings?.enable_images ?? false;

  const [showLinks, setShowLinks] = useLocalStorageState(LOCAL_STORAGE_SHOW_LINKS, false);
  const size = span?.data?.['http.decoded_response_content_length'];

  return (
    <StyledDescriptionWrapper>
      {isSettingsLoading ? (
        <LoadingIndicator size={30} />
      ) : isImagesEnabled ? (
        <ResourceImage
          fileName={formattedDescription}
          showImage={!showLinks}
          size={size}
          src={getImageSrc(span)}
        />
      ) : (
        <DisabledImages
          onClickShowLinks={() => setShowLinks(true)}
          projectSlug={span.project_slug ?? node.event?.projectSlug}
        />
      )}
    </StyledDescriptionWrapper>
  );
}

function ResourceImage(props: {
  fileName: string;
  showImage: boolean;
  size: number;
  src: string;
}) {
  const [hasError, setHasError] = useState(false);

  const {fileName, size, src, showImage = true} = props;

  return (
    <ImageContainer>
      <FilenameContainer>
        <span>
          {fileName} (<ResourceSize bytes={size} />)
        </span>
        <CopyToClipboardButton
          borderless
          size="zero"
          iconSize="xs"
          text={fileName}
          title={t('Copy file name')}
        />
      </FilenameContainer>
      {showImage && !hasError ? (
        <ImageWrapper>
          <img
            data-test-id="sample-image"
            onError={() => setHasError(true)}
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
          />
        </ImageWrapper>
      ) : (
        <MissingImage />
      )}
    </ImageContainer>
  );
}

const FilenameContainer = styled('div')`
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: ${space(1)};
  justify-content: space-between;
`;

const ImageWrapper = styled('div')`
  width: 200px;
  height: 180px;
  margin: auto;
`;

const ImageContainer = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(0.5)};
`;

const CodeSnippetWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const StyledIconGraph = styled(IconGraph)`
  margin-right: ${space(0.5)};
`;

const BodyContentWrapper = styled('div')<{padding: string}>`
  display: flex;
  gap: ${space(1)};
  padding: ${p => p.padding};
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  code {
    text-wrap: wrap;
  }
`;

const DescriptionWrapper = styled('div')`
  display: flex;
  align-items: baseline;
  font-size: ${p => p.theme.fontSize.md};
  width: 100%;
  justify-content: space-between;
  flex-direction: row;
  gap: ${space(1)};
  word-break: break-word;
  line-height: 1.4;
  padding: ${space(1)};
`;

const StyledDescriptionWrapper = styled(DescriptionWrapper)`
  padding: ${space(1)};
  justify-content: center;
`;

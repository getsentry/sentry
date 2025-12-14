import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {CodeBlock} from 'sentry/components/core/code';
import {Image} from 'sentry/components/core/image/image';
import {Link} from 'sentry/components/core/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LinkHint from 'sentry/components/structuredEventData/linkHint';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
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
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {getHighlightedSpanAttributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/highlightedAttributes';
import SpanSummaryLink from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/components/spanSummaryLink';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
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
  node: SpanNode;
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
    organization.features.includes('insight-modules');

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
      {hasExploreEnabled && (
        <StyledLink
          to={getSearchInExploreTarget(
            organization,
            location,
            node.event?.projectID,
            SpanFields.SPAN_DESCRIPTION,
            span.description!,
            TraceDrawerActionKind.INCLUDE
          )}
          onClick={() => {
            traceAnalytics.trackExploreSearch(
              organization,
              SpanFields.SPAN_DESCRIPTION,
              span.description!,
              TraceDrawerActionKind.INCLUDE,
              'drawer'
            );
          }}
        >
          <IconGraph type="scatter" size="xs" />
          {t('More Samples')}
        </StyledLink>
      )}
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
              text={formattedDescription}
              tooltipProps={{disabled: true}}
              aria-label={t('Copy formatted description to clipboard')}
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
      project={project}
      avgDuration={averageSpanDuration ? averageSpanDuration / 1000 : undefined}
      headerContent={value}
      bodyContent={actions}
      hideNodeActions={hideNodeActions}
      footerContent={
        event ? <TraceDrawerComponents.HighLightsOpsBreakdown event={event} /> : null
      }
      comparisonDescription={t('Average duration for this span over the last 24 hours')}
      highlightedAttributes={getHighlightedSpanAttributes({
        op: span.op,
        attributes: span.data,
        spanId: span.span_id,
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
  node: SpanNode;
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
          text={fileName}
          aria-label={t('Copy file name to clipboard')}
          title={t('Copy file name')}
        />
      </FilenameContainer>
      {showImage && !hasError ? (
        <ImageWrapper>
          <Image
            data-test-id="sample-image"
            alt="Resource Image"
            onError={() => setHasError(true)}
            src={src}
            objectFit="contain"
            objectPosition="center"
            width="100%"
            height="100%"
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

const BodyContentWrapper = styled('div')<{padding: string}>`
  display: flex;
  gap: ${space(1)};
  padding: ${p => p.padding};
`;

const StyledCodeSnippet = styled(CodeBlock)`
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

const StyledLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

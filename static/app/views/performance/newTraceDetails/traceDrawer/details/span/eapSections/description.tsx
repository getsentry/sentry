import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Link} from 'sentry/components/core/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LinkHint from 'sentry/components/structuredEventData/linkHint';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
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
  findSpanAttributeValue,
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {useOTelFriendlyUI} from 'sentry/views/performance/otlp/useOTelFriendlyUI';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {usePerformanceGeneralProjectSettings} from 'sentry/views/performance/utils';

const formatter = new SQLishFormatter();

export function SpanDescription({
  node,
  organization,
  location,
  project,
  attributes,
  avgSpanDuration,
  hideNodeActions,
}: {
  attributes: TraceItemResponseAttribute[];
  avgSpanDuration: number | undefined;
  location: Location;
  node: TraceTreeNode<TraceTree.EAPSpan>;
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
  const shouldUseOTelFriendlyUI = useOTelFriendlyUI();

  const category = findSpanAttributeValue(attributes, 'span.category');
  const dbSystem = findSpanAttributeValue(attributes, 'db.system');
  const dbQueryText = findSpanAttributeValue(attributes, 'db.query.text');
  const group = findSpanAttributeValue(attributes, 'span.group');

  const resolvedModule: ModuleName = resolveSpanModule(span.op, category);

  const formattedDescription = useMemo(() => {
    if (resolvedModule !== ModuleName.DB) {
      return span.description ?? '';
    }

    if (
      dbSystem === SupportedDatabaseSystem.MONGODB &&
      span.description &&
      isValidJson(span.description)
    ) {
      return prettyPrintJsonString(span.description).prettifiedQuery;
    }

    return formatter.toString(dbQueryText ?? span.description ?? '');
  }, [span.description, resolvedModule, dbSystem, dbQueryText]);

  const exploreAttributeName = shouldUseOTelFriendlyUI
    ? SpanFields.NAME
    : SpanFields.SPAN_DESCRIPTION;
  const exploreAttributeValue = shouldUseOTelFriendlyUI ? span.name : span.description;

  const actions = exploreAttributeValue ? (
    <BodyContentWrapper
      padding={
        resolvedModule === ModuleName.DB ? `${space(1)} ${space(2)}` : `${space(1)}`
      }
    >
      {node.value.is_transaction ? (
        <StyledLink
          to={transactionSummaryRouteWithQuery({
            organization,
            transaction: node.value.transaction,
            // Omit the query from the target url, as we dont know where it may have came from
            // and if its syntax is supported on the target page. In this example, txn search does
            // not support is:filter type expressions (and possibly other expressions we dont know about)
            query: omit(location.query, Object.values(PAGE_URL_PARAM).concat('query')),
            projectID: String(node.value.project_id),
          })}
        >
          <IconGraph type="area" size="xs" />
          {t('View Summary')}
        </StyledLink>
      ) : null}
      <SpanSummaryLink
        op={span.op}
        category={category}
        group={group}
        project_id={span.project_id.toString()}
        organization={organization}
      />
      {hasExploreEnabled && (
        <StyledLink
          to={getSearchInExploreTarget(
            organization,
            location,
            node.event?.projectID,
            exploreAttributeName,
            exploreAttributeValue,
            TraceDrawerActionKind.INCLUDE
          )}
          onClick={() => {
            traceAnalytics.trackExploreSearch(
              organization,
              exploreAttributeName,
              exploreAttributeValue,
              TraceDrawerActionKind.INCLUDE,
              'drawer'
            );
          }}
        >
          <IconGraph type="scatter" size="xs" />
          {hasExploreEnabled ? t('More Samples') : t('View Similar Spans')}
        </StyledLink>
      )}
    </BodyContentWrapper>
  ) : null;

  const codeFilepath = findSpanAttributeValue(attributes, 'code.filepath');
  const codeLineNumber = findSpanAttributeValue(attributes, 'code.lineno');
  const codeFunction = findSpanAttributeValue(attributes, 'code.function');

  const value =
    resolvedModule === ModuleName.DB ? (
      <CodeSnippetWrapper>
        <StyledCodeSnippet
          language={dbSystem === 'mongodb' ? 'json' : 'sql'}
          isRounded={false}
        >
          {formattedDescription}
        </StyledCodeSnippet>
        {codeFilepath ? (
          <StackTraceMiniFrame
            projectId={node.event?.projectID}
            event={event}
            frame={{
              filename: codeFilepath,
              lineNo: codeLineNumber ? Number(codeLineNumber) : null,
              function: codeFunction,
            }}
          />
        ) : (
          <MissingFrame />
        )}
      </CodeSnippetWrapper>
    ) : resolvedModule === ModuleName.RESOURCE && span.op === 'resource.img' ? (
      <ResourceImageDescription
        formattedDescription={formattedDescription}
        node={node}
        attributes={attributes}
      />
    ) : shouldUseOTelFriendlyUI && span.name ? (
      <DescriptionWrapper>
        <FormattedDescription>{span.name}</FormattedDescription>
        <CopyToClipboardButton
          borderless
          size="zero"
          text={span.name}
          tooltipProps={{disabled: true}}
        />
      </DescriptionWrapper>
    ) : (
      <DescriptionWrapper>
        {formattedDescription ? (
          <Fragment>
            <FormattedDescription>
              {formattedDescription}
              <LinkHint value={formattedDescription} />
            </FormattedDescription>
            <CopyToClipboardButton
              borderless
              size="zero"
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
      avgDuration={avgSpanDuration ? avgSpanDuration / 1000 : undefined}
      headerContent={value}
      bodyContent={actions}
      hideNodeActions={hideNodeActions}
      highlightedAttributes={getHighlightedSpanAttributes({
        organization,
        attributes,
        op: span.op,
      })}
    />
  );
}

function getImageSrc(span: TraceTree.EAPSpan, attributes: TraceItemResponseAttribute[]) {
  let src = span.description ?? '';

  // Account for relative URLs
  if (src.startsWith('/')) {
    const urlScheme = findSpanAttributeValue(attributes, 'url.scheme');
    const serverAddress = findSpanAttributeValue(attributes, 'server.address');

    if (urlScheme && serverAddress) {
      src = `${urlScheme}://${serverAddress}${src}`;
    }
  }

  return src;
}

function ResourceImageDescription({
  formattedDescription,
  attributes,
  node,
}: {
  attributes: TraceItemResponseAttribute[];
  formattedDescription: string;
  node: TraceTreeNode<TraceTree.EAPSpan>;
}) {
  const span = node.value;

  const {data: settings, isPending: isSettingsLoading} =
    usePerformanceGeneralProjectSettings(span.project_id);
  const isImagesEnabled = settings?.enable_images ?? false;

  const [showLinks, setShowLinks] = useLocalStorageState(LOCAL_STORAGE_SHOW_LINKS, false);

  const size = findSpanAttributeValue(attributes, 'http.decoded_response_content_length');

  return (
    <StyledDescriptionWrapper>
      {isSettingsLoading ? (
        <LoadingIndicator size={30} />
      ) : isImagesEnabled ? (
        <ResourceImage
          fileName={formattedDescription}
          showImage={!showLinks}
          size={size ? Number(size) : 0}
          src={getImageSrc(span, attributes)}
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

const StyledLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
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

const FormattedDescription = styled('div')`
  min-height: 24px;
  display: flex;
  align-items: center;
`;

const DescriptionWrapper = styled('div')`
  display: flex;
  align-items: flex-start;
  font-size: ${p => p.theme.fontSize.md};
  width: 100%;
  justify-content: space-between;
  flex-direction: row;
  gap: ${space(0.5)};
  word-break: break-word;
  padding: ${space(1)};
`;

const StyledDescriptionWrapper = styled(DescriptionWrapper)`
  padding: ${space(1)};
  justify-content: center;
`;

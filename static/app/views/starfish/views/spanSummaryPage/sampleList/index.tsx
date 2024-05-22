import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import Feature from 'sentry/components/acl/feature';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import SearchBar, {getHasTag} from 'sentry/components/events/searchBar';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {DEFAULT_COLUMN_ORDER} from 'sentry/views/starfish/components/samplesTable/spanSamplesTable';
import {
  ModuleName,
  SpanIndexedField,
  SpanMetricsField,
} from 'sentry/views/starfish/types';
import DurationChart from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart';
import SampleInfo from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleInfo';
import SampleTable from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleTable/sampleTable';

const {HTTP_RESPONSE_CONTENT_LENGTH, SPAN_DESCRIPTION} = SpanMetricsField;

type Props = {
  groupId: string;
  moduleName: ModuleName;
  transactionName: string;
  onClose?: () => void;
  spanDescription?: string;
  transactionMethod?: string;
  transactionRoute?: string;
};

// ////////////////////////
// START TRACES
// ////////////////////////

const omitSupportedTags = [SpanIndexedField.SPAN_AI_PIPELINE_GROUP];

const getTracesSupportedTags = () => {
  const tags: TagCollection = Object.fromEntries(
    Object.values(SpanIndexedField)
      .filter(v => !omitSupportedTags.includes(v))
      .map(v => [v, {key: v, name: v}])
  );
  tags.has = getHasTag(tags);
  return tags;
};

interface SpanFieldEntry {
  key: string;
  name: string;
}
type SpanFieldsResponse = SpanFieldEntry[];

const getDynamicSpanFieldsEndpoint = (orgSlug: string, selection): ApiQueryKey => [
  `/organizations/${orgSlug}/spans/fields/`,
  {
    query: {
      project: selection.projects,
      environment: selection.environments,
      statsPeriod: '1h', // Hard coded stats period to load recent tags fast
    },
  },
];

const useTracesSupportedTags = (): TagCollection => {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const staticTags = getTracesSupportedTags();

  const dynamicTagQuery = useApiQuery<SpanFieldsResponse>(
    getDynamicSpanFieldsEndpoint(organization.slug, selection),
    {
      staleTime: 0,
      retry: false,
    }
  );

  if (dynamicTagQuery.isSuccess) {
    const dynamicTags: TagCollection = Object.fromEntries(
      dynamicTagQuery.data.map(entry => [entry.key, entry])
    );
    return {
      ...dynamicTags,
      ...staticTags,
    };
  }

  return staticTags;
};

export type SpanResult<F extends string> = Record<F, any>;

// ////////////////////////
// END TRACES
// ////////////////////////

export function SampleList({
  groupId,
  moduleName,
  transactionName,
  transactionMethod,
  spanDescription,
  onClose,
  transactionRoute = '/performance/summary/',
}: Props) {
  const router = useRouter();
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );

  // A a transaction name is required to show the panel, but a transaction
  // method is not
  const detailKey = transactionName
    ? [groupId, transactionName, transactionMethod].filter(Boolean).join(':')
    : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceSetHighlightedSpanId = useCallback(
    debounce(id => {
      setHighlightedSpanId(id);
    }, 10),
    []
  );

  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {query} = useLocation();
  const {projects} = useProjects();

  const spanSearchQuery = decodeScalar(query.spanSearchQuery);
  const supportedTags = useTracesSupportedTags();

  const project = useMemo(
    () => projects.find(p => p.id === String(query.project)),
    [projects, query.project]
  );

  const handleSearch = (newSpanSearchQuery: string) => {
    router.replace({
      pathname: location.pathname,
      query: {
        ...query,
        spanSearchQuery: newSpanSearchQuery,
      },
    });
  };

  const onOpenDetailPanel = useCallback(() => {
    if (query.transaction) {
      trackAnalytics('performance_views.sample_spans.opened', {
        organization,
        source: moduleName,
      });
    }
  }, [organization, query.transaction, moduleName]);

  const label =
    transactionMethod && !transactionName.startsWith(transactionMethod)
      ? `${transactionMethod} ${transactionName}`
      : transactionName;

  const link = normalizeUrl(
    `/organizations/${organization.slug}${transactionRoute}?${qs.stringify({
      project: query.project,
      transaction: transactionName,
    })}`
  );

  // set additional query filters from the span search bar and the `query` param
  let extraQuery: string[] | undefined = spanSearchQuery?.split(' ');
  if (query.query) {
    extraQuery = Array.isArray(query.query) ? query.query : [query.query];
  }

  function defaultOnClose() {
    router.replace({
      pathname: router.location.pathname,
      query: omit(router.location.query, 'transaction', 'transactionMethod', 'query'),
    });
  }

  let columnOrder = DEFAULT_COLUMN_ORDER;

  const additionalFields: SpanIndexedField[] = [
    SpanIndexedField.TRACE,
    SpanIndexedField.TRANSACTION_ID,
  ];

  if (moduleName === ModuleName.RESOURCE) {
    additionalFields?.push(SpanIndexedField.HTTP_RESPONSE_CONTENT_LENGTH);
    additionalFields?.push(SpanIndexedField.SPAN_DESCRIPTION);

    columnOrder = [
      ...DEFAULT_COLUMN_ORDER,
      {
        key: HTTP_RESPONSE_CONTENT_LENGTH,
        name: t('Encoded Size'),
        width: COL_WIDTH_UNDEFINED,
      },
      {
        key: SPAN_DESCRIPTION,
        name: t('Resource Name'),
        width: COL_WIDTH_UNDEFINED,
      },
    ];
  }

  return (
    <PageAlertProvider>
      <DetailPanel
        detailKey={detailKey}
        onClose={() => {
          onClose ? onClose() : defaultOnClose();
        }}
        onOpen={onOpenDetailPanel}
      >
        <HeaderContainer>
          {project && (
            <SpanSummaryProjectAvatar
              project={project}
              direction="left"
              size={40}
              hasTooltip
              tooltip={project.slug}
            />
          )}
          <TitleContainer>
            {spanDescription && <SpanDescription>{spanDescription}</SpanDescription>}
            <Title>
              <Link to={link}>{label}</Link>
            </Title>
          </TitleContainer>
        </HeaderContainer>
        <PageAlert />

        <SampleInfo
          groupId={groupId}
          transactionName={transactionName}
          transactionMethod={transactionMethod}
        />

        <DurationChart
          groupId={groupId}
          transactionName={transactionName}
          transactionMethod={transactionMethod}
          additionalFields={additionalFields}
          onClickSample={span => {
            router.push(
              `/performance/${span.project}:${span['transaction.id']}/#span-${span.span_id}`
            );
          }}
          onMouseOverSample={sample => debounceSetHighlightedSpanId(sample.span_id)}
          onMouseLeaveSample={() => debounceSetHighlightedSpanId(undefined)}
          query={extraQuery}
          highlightedSpanId={highlightedSpanId}
        />

        <Feature features="performance-sample-panel-search">
          <StyledSearchBar
            searchSource="queries-sample-panel"
            query={spanSearchQuery}
            onSearch={handleSearch}
            placeholder={t('Search for span attributes')}
            organization={organization}
            metricAlert={false}
            supportedTags={supportedTags}
            dataset={DiscoverDatasets.SPANS_INDEXED}
            projectIds={selection.projects}
          />
        </Feature>

        <SampleTable
          highlightedSpanId={highlightedSpanId}
          transactionMethod={transactionMethod}
          onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
          onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
          groupId={groupId}
          moduleName={moduleName}
          transactionName={transactionName}
          query={extraQuery}
          columnOrder={columnOrder}
          additionalFields={additionalFields}
        />
      </DetailPanel>
    </PageAlertProvider>
  );
}

const SpanSummaryProjectAvatar = styled(ProjectAvatar)`
  padding-right: ${space(1)};
`;

const HeaderContainer = styled('div')`
  width: 100%;
  padding-bottom: ${space(2)};
  padding-top: ${space(1)};

  display: grid;
  grid-template-rows: auto auto auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;

const TitleContainer = styled('div')`
  width: 100%;
  position: relative;
  height: 40px;
`;

const Title = styled('h4')`
  position: absolute;
  bottom: 0;
  margin-bottom: 0;
`;

const SpanDescription = styled('div')`
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 35vw;
`;

const StyledSearchBar = styled(SearchBar)`
  margin-top: ${space(2)};
`;

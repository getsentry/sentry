import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {DATA_TYPE} from 'sentry/views/insights/browser/resources/settings';
import DetailPanel from 'sentry/views/insights/common/components/detailPanel';
import {DEFAULT_COLUMN_ORDER} from 'sentry/views/insights/common/components/samplesTable/spanSamplesTable';
import DurationChart from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart';
import SampleInfo from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/sampleInfo';
import SampleTable from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/sampleTable/sampleTable';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {
  ModuleName,
  SpanIndexedField,
  SpanMetricsField,
  type SubregionCode,
} from 'sentry/views/insights/types';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

const {HTTP_RESPONSE_CONTENT_LENGTH, SPAN_DESCRIPTION} = SpanMetricsField;

type Props = {
  groupId: string;
  moduleName: ModuleName;
  transactionName: string;
  onClose?: () => void;
  referrer?: string;
  subregions?: SubregionCode[];
  transactionMethod?: string;
  transactionRoute?: string;
};

export function SampleList({
  groupId,
  moduleName,
  transactionName,
  transactionMethod,
  subregions,
  onClose,
  transactionRoute,
  referrer,
}: Props) {
  const organization = useOrganization();
  const {view} = useDomainViewFilters();
  const router = useRouter();
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );

  transactionRoute ??= `/${getTransactionSummaryBaseUrl(organization.slug, view, true)}`;

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

  const {selection} = usePageFilters();
  const location = useLocation();
  const {projects} = useProjects();

  const spanSearchQuery = decodeScalar(location.query.spanSearchQuery);

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const handleSearch = (newSpanSearchQuery: string) => {
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        spanSearchQuery: newSpanSearchQuery,
      },
    });
  };

  const onOpenDetailPanel = useCallback(() => {
    if (location.query.transaction) {
      trackAnalytics('performance_views.sample_spans.opened', {
        organization,
        source: moduleName,
      });
    }
  }, [organization, location.query.transaction, moduleName]);

  const label =
    transactionMethod && !transactionName.startsWith(transactionMethod)
      ? `${transactionMethod} ${transactionName}`
      : transactionName;

  const link = normalizeUrl(
    `/organizations/${organization.slug}${transactionRoute}?${qs.stringify({
      project: location.query.project,
      transaction: transactionName,
    })}`
  );

  // set additional query filters from the span search bar and the `query` param
  const spanSearch = new MutableSearch(spanSearchQuery ?? '');
  if (location.query.query) {
    (Array.isArray(location.query.query)
      ? location.query.query
      : [location.query.query]
    ).forEach(filter => {
      spanSearch.addStringFilter(filter);
    });
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
        name: `${DATA_TYPE} ${t('Name')}`,
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
          <Title>
            <Link to={link}>{label}</Link>
          </Title>
        </HeaderContainer>
        <PageAlert />

        <SampleInfo
          groupId={groupId}
          transactionName={transactionName}
          transactionMethod={transactionMethod}
          subregions={subregions}
        />

        <DurationChart
          groupId={groupId}
          transactionName={transactionName}
          transactionMethod={transactionMethod}
          subregions={subregions}
          additionalFields={additionalFields}
          onClickSample={span => {
            router.push(
              generateLinkToEventInTraceView({
                eventId: span['transaction.id'],
                projectSlug: span.project,
                spanId: span.span_id,
                location,
                organization,
                traceSlug: span.trace,
                timestamp: span.timestamp,
              })
            );
          }}
          onMouseOverSample={sample => debounceSetHighlightedSpanId(sample.span_id)}
          onMouseLeaveSample={() => debounceSetHighlightedSpanId(undefined)}
          spanSearch={spanSearch}
          highlightedSpanId={highlightedSpanId}
        />

        <StyledSearchBar>
          <SpanSearchQueryBuilder
            projects={selection.projects}
            initialQuery={spanSearchQuery ?? ''}
            onSearch={handleSearch}
            placeholder={t('Search for span attributes')}
            searchSource={`${moduleName}-sample-panel`}
          />
        </StyledSearchBar>

        <SampleTable
          highlightedSpanId={highlightedSpanId}
          transactionMethod={transactionMethod}
          onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
          onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
          groupId={groupId}
          moduleName={moduleName}
          transactionName={transactionName}
          subregions={subregions}
          spanSearch={spanSearch}
          columnOrder={columnOrder}
          additionalFields={additionalFields}
          referrer={referrer}
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
  align-items: center;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr;
  }
`;

const Title = styled('h4')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  margin: 0;
`;

const StyledSearchBar = styled('div')`
  margin: ${space(2)} 0;
`;

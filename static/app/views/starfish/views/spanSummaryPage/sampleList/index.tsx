import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {DEFAULT_COLUMN_ORDER} from 'sentry/views/starfish/components/samplesTable/spanSamplesTable';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import DurationChart from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart';
import SampleInfo from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleInfo';
import SampleTable from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleTable/sampleTable';

const {HTTP_RESPONSE_CONTENT_LENGTH} = SpanMetricsField;

type Props = {
  groupId: string;
  transactionName: string;
  additionalFields?: string[];
  onClose?: () => void;
  spanDescription?: string;
  transactionMethod?: string;
  transactionRoute?: string;
};

export function SampleList({
  groupId,
  transactionName,
  transactionMethod,
  spanDescription,
  additionalFields,
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
  const {query} = useLocation();
  const {projects} = useProjects();

  const project = useMemo(
    () => projects.find(p => p.id === String(query.project)),
    [projects, query.project]
  );

  const onOpenDetailPanel = useCallback(() => {
    if (query.transaction) {
      trackAnalytics('starfish.panel.open', {organization});
    }
  }, [organization, query.transaction]);

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

  let extraQuery: string[] | undefined = undefined;
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

  if (additionalFields?.includes(HTTP_RESPONSE_CONTENT_LENGTH)) {
    columnOrder = [
      ...DEFAULT_COLUMN_ORDER,
      {
        key: HTTP_RESPONSE_CONTENT_LENGTH,
        name: t('Encoded Size'),
        width: COL_WIDTH_UNDEFINED,
      },
    ];
  }

  return (
    <PageErrorProvider>
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
        <PageErrorAlert />

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

        <SampleTable
          highlightedSpanId={highlightedSpanId}
          transactionMethod={transactionMethod}
          onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
          onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
          groupId={groupId}
          transactionName={transactionName}
          query={extraQuery}
          columnOrder={columnOrder}
          additionalFields={additionalFields}
        />
      </DetailPanel>
    </PageErrorProvider>
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

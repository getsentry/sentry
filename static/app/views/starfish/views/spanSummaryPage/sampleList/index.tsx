import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Link from 'sentry/components/links/link';
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
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import DurationChart from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart';
import SampleInfo from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleInfo';
import SampleTable from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleTable/sampleTable';

type Props = {
  groupId: string;
  projectId: number;
  transactionMethod: string;
  transactionName: string;
};

export function SampleList({
  groupId,
  projectId,
  transactionName,
  transactionMethod,
}: Props) {
  const router = useRouter();
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );
  const detailKey =
    groupId && transactionName && transactionMethod
      ? `${groupId}:${transactionName}:${transactionMethod}`
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
    () => projects.find(p => p.id === String(projectId)),
    [projects, projectId]
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

  const link = `/performance/summary/?${qs.stringify({
    project: projectId,
    transaction: transactionName,
  })}`;

  return (
    <PageErrorProvider>
      <DetailPanel
        detailKey={detailKey}
        onClose={() => {
          router.replace({
            pathname: router.location.pathname,
            query: omit(router.location.query, 'transaction', 'transactionMethod'),
          });
        }}
        onOpen={onOpenDetailPanel}
      >
        {project && (
          <SpanSummaryProjectAvatar
            project={project}
            direction="left"
            size={40}
            hasTooltip
            tooltip={project.slug}
          />
        )}
        <h3>
          <Link to={link}>{label}</Link>
        </h3>
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
          onClickSample={span => {
            router.push(
              `/performance/${span.project}:${span['transaction.id']}/#span-${span.span_id}`
            );
          }}
          onMouseOverSample={sample => debounceSetHighlightedSpanId(sample.span_id)}
          onMouseLeaveSample={() => debounceSetHighlightedSpanId(undefined)}
          highlightedSpanId={highlightedSpanId}
        />

        <SampleTable
          highlightedSpanId={highlightedSpanId}
          transactionMethod={transactionMethod}
          onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
          onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
          groupId={groupId}
          transactionName={transactionName}
        />
      </DetailPanel>
    </PageErrorProvider>
  );
}

const SpanSummaryProjectAvatar = styled(ProjectAvatar)`
  padding-top: ${space(1)};
  padding-bottom: ${space(2)};
`;

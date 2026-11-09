import {useEffect, useRef} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import {shouldRefreshOnFocus} from 'sentry/views/investigations/actionRequests/actionRequestDetails';
import {
  getInvestigationDetailQueryOptions,
  investigationOrchestrationQueryOptions,
  isFollowUpPending,
} from 'sentry/views/investigations/api';
import {shouldPollInvestigationRun} from 'sentry/views/investigations/hypotheses/investigationHypotheses';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

import {shouldPollInvestigationBlocks} from './block';
import {isTitleGenerationActive} from './utils';

export function useInvestigationDetail(investigationId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organization.slug,
    investigationId
  );
  // Seer Agent can write blocks, start their runs, and steer the investigation
  // from a chat on this page. Its writes go to routes under the investigation,
  // which the refresh after a Seer write doesn't tie to these queries, and a
  // settled investigation has stopped polling.
  const isSeerWorking = useSeerExplorerContext().sessionState === 'thinking';
  const detailQuery = useQuery({
    ...detailOptions,
    refetchInterval: query => {
      const data = query.state.data?.json;
      // A live agentic run keeps this polling too: the notebook fills in as the
      // agent writes blocks, and `orchestration` is what gates the hypothesis
      // row, so a stale copy would leave the row hidden or showing a run that
      // has since finished.
      const orchestrationActive =
        data?.orchestration && shouldPollInvestigationRun(data.orchestration.status);
      return isSeerWorking ||
        orchestrationActive ||
        data?.actionRequests?.some(isFollowUpPending) ||
        shouldPollInvestigationBlocks(data?.blocks ?? []) ||
        isTitleGenerationActive(data?.titleGeneration?.status)
        ? 2000
        : false;
    },
    refetchOnWindowFocus: query =>
      query.state.data?.json.actionRequests?.some(shouldRefreshOnFocus)
        ? 'always'
        : false,
  });
  const {refetch} = detailQuery;

  const wasSeerWorking = useRef(isSeerWorking);
  useEffect(() => {
    if (wasSeerWorking.current && !isSeerWorking) {
      // Picks up what it wrote after the last poll, and a run it restarted.
      void refetch();
      void queryClient.invalidateQueries({
        queryKey: investigationOrchestrationQueryOptions(
          organization.slug,
          investigationId
        ).queryKey,
      });
    }
    wasSeerWorking.current = isSeerWorking;
  }, [investigationId, isSeerWorking, organization.slug, queryClient, refetch]);

  return detailQuery;
}

import {useHover} from '@react-aria/interactions';
import {useDebouncer} from '@tanstack/react-pacer';
import {useQueryClient} from '@tanstack/react-query';

import {autofixSetupApiOptions} from 'sentry/components/events/autofix/useAutofixSetup';
import {explorerAutofixApiOptions} from 'sentry/components/events/autofix/useExplorerAutofix';
import {linkedPullRequestsApiOptions} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import type {Group} from 'sentry/types/group';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

const PREFETCH_DELAY_MS = 300;

/**
 * Warms the preview's requests on hover so clicking renders from cache. Reuses
 * the preview's own options factories so the query keys match.
 */
export function useInboxPreviewPrefetch(group: Group) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const environments = useEnvironmentsFromUrl();
  const shouldPrefetchAutofix =
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-features') &&
    getConfigForIssueType(group, group.project).autofix;
  const prefetchDebouncer = useDebouncer(
    () => {
      void queryClient.prefetchQuery(
        groupApiOptions({
          groupId: group.id,
          organizationSlug: organization.slug,
          environments,
          expandDerivedData: organization.features.includes('issue-inbox'),
        })
      );
      void queryClient.prefetchQuery(
        linkedPullRequestsApiOptions({
          groupId: group.id,
          organizationSlug: organization.slug,
        })
      );
      void queryClient.prefetchQuery(
        autofixSetupApiOptions({
          groupId: group.id,
          organizationSlug: organization.slug,
        })
      );
      if (shouldPrefetchAutofix) {
        void queryClient.prefetchQuery({
          ...explorerAutofixApiOptions(organization.slug, group.id),
          retry: false,
        });
      }
    },
    {wait: PREFETCH_DELAY_MS}
  );

  const {hoverProps} = useHover({
    onHoverStart: () => prefetchDebouncer.maybeExecute(),
    onHoverEnd: () => prefetchDebouncer.cancel(),
  });

  return hoverProps;
}

import {useFocus, useHover} from '@react-aria/interactions';
import {useQueryClient} from '@tanstack/react-query';

import {autofixSetupApiOptions} from 'sentry/components/events/autofix/useAutofixSetup';
import {explorerAutofixApiOptions} from 'sentry/components/events/autofix/useExplorerAutofix';
import {linkedPullRequestsApiOptions} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import type {Group} from 'sentry/types/group';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

/**
 * Warms each of the preview's independent requests as soon as a user shows
 * intent to open an issue. Reuses the preview's own options factories so the
 * query keys match.
 */
export function useInboxPreviewPrefetch(group: Group) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const environments = useEnvironmentsFromUrl();
  const shouldPrefetchAutofix =
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-features') &&
    getConfigForIssueType(group, group.project).autofix;
  const prefetch = () => {
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
  };

  const {hoverProps} = useHover({
    onHoverStart: prefetch,
  });
  const {focusProps} = useFocus({
    onFocus: prefetch,
  });

  return {
    ...hoverProps,
    ...focusProps,
  };
}

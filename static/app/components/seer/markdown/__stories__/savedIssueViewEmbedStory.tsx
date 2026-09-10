import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupSearchViewsApiOptions} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {GroupSearchViewCreatedBy} from 'sentry/views/issueList/types';

import {EmbedStory, EmbedVariant} from './embedStory';

export function SavedIssueViewEmbedStory() {
  const organization = useOrganization();
  const ownedViewsQuery = useQuery(
    groupSearchViewsApiOptions({
      orgSlug: organization.slug,
      createdBy: GroupSearchViewCreatedBy.ME,
      limit: 1,
      sort: ['-visited', '-popularity', '-created'],
    })
  );
  const sharedViewsQuery = useQuery({
    ...groupSearchViewsApiOptions({
      orgSlug: organization.slug,
      createdBy: GroupSearchViewCreatedBy.OTHERS,
      limit: 1,
      sort: ['-popularity', '-visited', '-created'],
    }),
    enabled: !ownedViewsQuery.isPending && !ownedViewsQuery.data?.length,
  });
  const view = ownedViewsQuery.data?.[0] ?? sharedViewsQuery.data?.[0];
  const isPending = !view && (ownedViewsQuery.isPending || sharedViewsQuery.isPending);
  const isError = !view && (ownedViewsQuery.isError || sharedViewsQuery.isError);

  return (
    <EmbedStory name="savedIssueView">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a saved issue view example.</Text>
      ) : view ? (
        <EmbedVariant
          name="savedIssueView"
          label="Saved issue view"
          data={{id: view.id, name: view.name}}
        />
      ) : (
        <Text variant="muted">
          No saved issue view is available for this organization.
        </Text>
      )}
    </EmbedStory>
  );
}

import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupSearchViewsApiOptions} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';

import {EmbedStory, EmbedVariant} from './embedStory';

export function SavedIssueViewEmbedStory() {
  const organization = useOrganization();
  const {
    data: views,
    isError,
    isPending,
  } = useQuery(
    groupSearchViewsApiOptions({
      orgSlug: organization.slug,
      limit: 1,
      sort: ['-visited'],
    })
  );
  const view = views?.[0];

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

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useGetSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';

import {EmbedStory, EmbedVariant} from './embedStory';

export function SavedQueryEmbedStory() {
  const {
    data: savedQueries,
    isLoading,
    isError,
  } = useGetSavedQueries({sortBy: ['-dateUpdated'], perPage: 1});

  const savedQuery = savedQueries?.[0];

  return (
    <EmbedStory name="savedQuery">
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a saved query example.</Text>
      ) : savedQuery ? (
        <EmbedVariant
          name="savedQuery"
          label="Saved query"
          data={{
            id: String(savedQuery.id),
            dataset: savedQuery.dataset,
            name: savedQuery.name,
          }}
        />
      ) : (
        <Text variant="muted">No saved query is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}

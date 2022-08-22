import TagStore from 'sentry/stores/tagStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {TagCollection} from 'sentry/types';

type Result = {
  tags: TagCollection;
};

function useTags(): Result {
  const tags = useLegacyStore(TagStore);

  return {
    tags,
  };
}

export default useTags;

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

// TODO(Leander): Update once the docs have been put up
export const TAGS_TREE_DOCS_LINK = `https://docs.sentry.io`;
export const CONTEXT_DOCS_LINK = `https://docs.sentry.io/platform-redirect/?next=/enriching-events/context/`;

export function shouldUseNewTagsUI() {
  const location = useLocation();
  const organization = useOrganization();
  return location.query.tagsTree || organization.features.includes('event-tags-tree-ui');
}

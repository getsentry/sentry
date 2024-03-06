import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export const TAGS_DOCS_LINK = `https://docs.sentry.io/platform-redirect/?next=/enriching-events/tags`;

export function shouldUseNewTagsUI() {
  const location = useLocation();
  const organization = useOrganization();
  return (
    location.query.tagsTree === '1' ||
    organization.features.includes('event-tags-tree-ui')
  );
}

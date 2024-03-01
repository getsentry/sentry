import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export function shouldDisplayTagsTree() {
  const location = useLocation();
  const organization = useOrganization();
  return location.query.tagsTree || organization.features.includes('event-tags-tree-ui');
}

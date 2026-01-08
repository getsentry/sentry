import qs from 'query-string';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getExploreUrl} from 'sentry/views/explore/utils';

type GetExploreUrlParams = Parameters<typeof getExploreUrl>[0];

const MY_PROJECTS_URL_PARAM = 0;

/**
 * Wraps getExploreUrl to ensure project selection is always in the URL.
 * When "My Projects" is selected (empty array), appends project=0.
 * This prevents Explore from overwriting the project selection.
 *
 * TODO(telemetry-experience): Remove once Explore properly handles project selection.
 */
export function getExploreUrlWithProjectSelection({
  selection,
  organization,
  ...rest
}: GetExploreUrlParams & {organization: Organization; selection: PageFilters}) {
  const url = getExploreUrl({selection, organization, ...rest});

  // Empty projects array means "My Projects" - append project=0 to URL
  if (selection.projects.length === 0) {
    const parsed = qs.parseUrl(url);
    parsed.query.project = String(MY_PROJECTS_URL_PARAM);
    return qs.stringifyUrl(parsed);
  }

  return url;
}

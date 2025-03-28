import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {PIPELINE_BASE_URL} from 'sentry/views/pipeline/settings';

interface MakePipelinePathnameArgs {
  organization: Organization;
  path: '/' | `/${string}/`;
}

export function makePipelinePathname({path, organization}: MakePipelinePathnameArgs) {
  return normalizeUrl(`/organizations/${organization.slug}/${PIPELINE_BASE_URL}${path}`);
}

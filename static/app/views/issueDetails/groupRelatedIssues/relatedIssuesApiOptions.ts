import {skipToken} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface RelationTypeMetaBase {
  status: 'ok' | 'not_applicable' | 'unavailable';
  detail?: string;
}

type SimilarStacktraceMeta = RelationTypeMetaBase & {
  type: 'similar_stacktrace';
  eventId?: string;
};

export type SameTraceMeta = RelationTypeMetaBase & {
  type: 'same_trace';
  eventId?: string;
  traceId?: string;
};

type ContributingMeta = RelationTypeMetaBase & {
  type: 'contributing';
  end?: string | null;
  eventId?: string;
  start?: string;
};

type RelationTypeMeta = SimilarStacktraceMeta | SameTraceMeta | ContributingMeta;

type RelationType = RelationTypeMeta['type'];

type RelatedIssueRelation =
  | {score: number; type: 'similar_stacktrace'}
  | {type: 'same_trace'}
  | {type: 'contributing'};

export interface RelatedIssue {
  issue: Group;
  relations: RelatedIssueRelation[];
}

interface RelatedIssuesResponse {
  data: RelatedIssue[];
  meta: {types: RelationTypeMeta[]};
}

interface RelatedIssuesApiOptionsParams {
  groupId: string;
  organization: Organization;
  enabled?: boolean;
  limit?: number;
  /**
   * The types of related issues to return. Returns every type when left out.
   */
  types?: RelationType[];
}

/**
 * Asks the related issues endpoint for related issues of the given types.
 */
export function relatedIssuesApiOptions({
  groupId,
  organization,
  enabled = true,
  limit,
  types,
}: RelatedIssuesApiOptionsParams) {
  return apiOptions.as<RelatedIssuesResponse>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/related/',
    {
      path: enabled
        ? {organizationIdOrSlug: organization.slug, issueId: groupId}
        : skipToken,
      query: {type: types, limit},
      staleTime: 0,
    }
  );
}

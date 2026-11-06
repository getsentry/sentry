import type {ComponentType} from 'react';
import {IconIssues} from '@sentry/icons/issues';
import {IconSeer} from '@sentry/icons/seer';
import type {SVGIconProps} from '@sentry/icons/svgIcon';

import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

import type {InboxSubject, InboxSubjectType} from './types';

interface InboxSubjectConfig {
  icon: ComponentType<SVGIconProps>;
  /**
   * URL segment for the subject within the inbox, e.g. `/inbox/{pathSegment}/{subjectId}/`.
   * Must match the inbox child routes in `routes.tsx`.
   */
  pathSegment: string;
}

export const INBOX_SUBJECT_CONFIG: Record<InboxSubjectType, InboxSubjectConfig> = {
  issue: {
    icon: IconIssues,
    pathSegment: 'issue',
  },
  notebook: {
    icon: IconSeer,
    pathSegment: 'notebook',
  },
};

export function getInboxItemPath(organization: Organization, item: InboxSubject) {
  const {pathSegment} = INBOX_SUBJECT_CONFIG[item.subjectType];
  return normalizeUrl(
    `/organizations/${organization.slug}/inbox/${pathSegment}/${item.subjectId}/`
  );
}

export function getInboxSubjectFromPath(
  pathname: string,
  subjectId: string | undefined
): InboxSubject | null {
  if (!subjectId) {
    return null;
  }

  const subjectType = (Object.keys(INBOX_SUBJECT_CONFIG) as InboxSubjectType[]).find(
    type => pathname.includes(`/inbox/${INBOX_SUBJECT_CONFIG[type].pathSegment}/`)
  );

  return subjectType ? {subjectType, subjectId} : null;
}

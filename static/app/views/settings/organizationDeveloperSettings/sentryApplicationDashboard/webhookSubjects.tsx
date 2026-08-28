import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

const EMPTY_VALUE = '—';

type SubjectSpec = {
  label: string;
  getUrl?: (id: string, organization: Organization) => string;
};

/**
 * Mapping of subjects to their labels and URLs to link to.
 */
const SUBJECT_SPECS: Record<string, SubjectSpec> = {
  event: {
    label: t('Event'),
    getUrl: (id, organization) =>
      `/organizations/${organization.slug}/issues/?query=${id}`,
  },
  group: {
    label: t('Issue'),
    getUrl: (id, organization) => `/organizations/${organization.slug}/issues/${id}/`,
  },
  alert_rule: {
    label: t('Alert Rule'),
    getUrl: (id, organization) =>
      makeAlertsPathname({organization, path: `/rules/details/${id}/`}),
  },
  preprod_artifact: {
    label: t('Build'),
    getUrl: (id, organization) =>
      `/organizations/${organization.slug}/preprod/size/${id}/`,
  },
  comment: {label: t('Comment')},
  installation: {label: t('Installation')},
  autofix_run: {label: t('Autofix Run')},
};

interface WebhookSubjectProps {
  isInternal: boolean; // We only want to render links for internal apps (i.e the same org)
  organization: Organization;
  disableLink?: boolean;
  subjectId?: string | null;
  subjectType?: string | null;
}

export function WebhookSubject({
  subjectType,
  subjectId,
  isInternal,
  organization,
  disableLink = false,
}: WebhookSubjectProps) {
  if (!subjectType || !subjectId) {
    return <Text>{EMPTY_VALUE}</Text>;
  }

  const spec = SUBJECT_SPECS[subjectType];
  const label = spec?.label ?? subjectType;
  const content = `${label} ${subjectId}`;

  if (!disableLink && isInternal && spec?.getUrl) {
    return (
      <Link to={spec.getUrl(subjectId, organization)}>
        <Text ellipsis>{content}</Text>
      </Link>
    );
  }

  return <Text ellipsis>{content}</Text>;
}

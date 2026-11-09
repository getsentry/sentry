import {IconStar} from '@sentry/icons/star';

import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ResourceLink, type ResourceLinkFormatProps} from './resourceLink';

export function getSavedIssueViewHref(id: string, organizationSlug: string): string {
  return normalizeUrl(`/organizations/${organizationSlug}/issues/views/${id}/`);
}

export function SavedIssueViewLink({
  format,
  id,
  name,
}: EmbedOutput<'savedIssueView'> & ResourceLinkFormatProps) {
  const organization = useOrganization();
  const href = getSavedIssueViewHref(id, organization.slug);

  return (
    <ResourceLink
      format={format}
      icon={IconStar}
      href={href}
      title={name ?? t('Issue view %s', id)}
    />
  );
}

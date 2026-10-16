import type {ReactNode} from 'react';
import {IconIssues} from '@sentry/icons/issues';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

type SourceLink = {
  icon: ReactNode;
  label: string;
  to: string;
};

type SourceLinkResolver = (
  source: Record<string, unknown> | undefined,
  organizationSlug: string
) => SourceLink | null;

/**
 * How each source type links back to where the investigation started. To link
 * a new source type, add an entry here. Types without an entry show their name
 * instead of a link.
 */
const SOURCE_LINKS: Record<string, SourceLinkResolver> = {
  // A breached metric investigation references the metric issue it started
  // from. Older investigations may lack the monitor snapshot.
  metric_open_period: (source, organizationSlug) => {
    const groupId = getString(getRecord(source, 'ref'), 'groupId');
    if (!groupId) {
      return null;
    }
    return {
      icon: <IconIssues size="xs" />,
      label:
        getString(getRecord(getRecord(source, 'snapshot'), 'monitor'), 'name') ??
        t('View issue'),
      to: normalizeUrl(`/organizations/${organizationSlug}/issues/${groupId}/`),
    };
  },
};

export function getInvestigationSourceLink(
  investigation: Pick<InvestigationDetail, 'source' | 'sourceType'>,
  organizationSlug: string
): SourceLink | null {
  const resolve = SOURCE_LINKS[investigation.sourceType];
  return resolve ? resolve(investigation.source, organizationSlug) : null;
}

/**
 * Links back to where the investigation started, or names the source when
 * there is nothing to link to.
 */
export function InvestigationSourceLink({
  investigation,
}: {
  investigation: Pick<InvestigationDetail, 'source' | 'sourceType'>;
}) {
  const organization = useOrganization();
  const link = getInvestigationSourceLink(investigation, organization.slug);

  if (!link) {
    return <Text variant="muted">{formatSourceType(investigation.sourceType)}</Text>;
  }

  return (
    <Link to={link.to}>
      <Flex as="span" align="center" gap="xs">
        {link.icon}
        {link.label}
      </Flex>
    </Link>
  );
}

function formatSourceType(sourceType: string) {
  if (sourceType === 'metric_open_period') {
    return t('Breached metric');
  }
  if (sourceType === 'manual') {
    return t('Manual investigation');
  }
  return sourceType.replaceAll('_', ' ');
}

function getRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const field: unknown = (value as Record<string, unknown>)[key];
  return field && typeof field === 'object' ? (field as Record<string, unknown>) : null;
}

function getString(value: Record<string, unknown> | null, key: string): string | null {
  const field = value?.[key];
  return typeof field === 'string' && field ? field : null;
}

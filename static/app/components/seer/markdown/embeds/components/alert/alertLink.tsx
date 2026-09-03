import {getAlertDetailsPathname} from 'sentry/components/seer/markdown/embeds/components/alert/getAlertDetailsPathname';
import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AlertLink({
  format,
  id,
  detectorId,
  kind,
  name,
}: EmbedOutput<'alert'> & ResourceLinkFormatProps) {
  const organization = useOrganization();

  const resourceId = detectorId ?? id;
  const href = getAlertDetailsPathname(organization, {id, detectorId, kind, name});

  return (
    <ResourceLink
      format={format}
      icon={IconSiren}
      href={href}
      title={name ?? t('Alert %s', resourceId)}
    />
  );
}

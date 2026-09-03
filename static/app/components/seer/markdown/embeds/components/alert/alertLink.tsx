import {getAlertDetailsPathname} from 'sentry/components/seer/markdown/embeds/components/alert/getAlertDetailsPathname';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AlertLink({id, detectorId, kind, name}: EmbedOutput<'alert'>) {
  const organization = useOrganization();

  const resourceId = detectorId ?? id;
  const href = getAlertDetailsPathname(organization, {id, detectorId, kind, name});

  return (
    <ResourceLink
      icon={IconSiren}
      href={href}
      title={name ?? t('Alert %s', resourceId)}
    />
  );
}

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

export function MonitorLink({id, name}: EmbedOutput<'monitor'>) {
  const organization = useOrganization();
  const href = makeMonitorDetailsPathname(organization.slug, id);

  return (
    <ResourceLink icon={IconTimer} href={href} title={name ?? t('Monitor %s', id)} />
  );
}

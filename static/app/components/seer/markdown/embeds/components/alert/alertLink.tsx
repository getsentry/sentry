import {getAlertDetailsPathname} from 'sentry/components/seer/markdown/embeds/components/alert/alertUtils';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AlertLink(props: EmbedOutput<'alert'>) {
  const organization = useOrganization();
  const {id, name} = props;

  // `id` is the alert id the model was given, so it is the one a reader can
  // match against the alerts UI -- the detector id only belongs in the href.
  return (
    <ResourceLink
      icon={IconSiren}
      href={getAlertDetailsPathname(organization, props)}
      title={name ?? t('Alert %s', id)}
    />
  );
}

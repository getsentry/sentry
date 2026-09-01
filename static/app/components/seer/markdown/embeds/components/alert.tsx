import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

function AlertLink({id, kind, name}: EmbedOutput<'alert'>) {
  const organization = useOrganization();

  // Under the workflow engine an issue alert is an automation, while metric,
  // uptime and cron alerts are all detectors.
  const href =
    kind === 'issue'
      ? makeAutomationDetailsPathname(organization.slug, id)
      : makeMonitorDetailsPathname(organization.slug, id);

  return <ResourceLink icon={IconSiren} href={href} title={name ?? t('Alert %s', id)} />;
}

export const Alert = defineSeerEmbed({
  name: 'alert',
  render(props) {
    return <AlertLink {...props} />;
  },
});

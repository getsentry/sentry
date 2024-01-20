import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

interface Props {
  primaryAction: 'create' | 'setup';
  projectSlug: string;
}

export default function ReplayUnsupportedAlert({primaryAction, projectSlug}: Props) {
  const link = (
    <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/" />
  );
  return (
    <Alert icon={<IconInfo />}>
      <strong>{t(`Session Replay isn't available for %s.`, projectSlug)}</strong>{' '}
      {primaryAction === 'create'
        ? tct(
            `Create a project using our [link:Sentry browser SDK package], or equivalent framework SDK.`,
            {link}
          )
        : tct(
            `Select a project using our [link:Sentry browser SDK package], or equivalent framework SDK.`,
            {link}
          )}
    </Alert>
  );
}

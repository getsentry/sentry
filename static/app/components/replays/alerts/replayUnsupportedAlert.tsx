import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

interface Props {
  projectSlug: string;
}

export default function ReplayUnsupportedAlert({projectSlug}: Props) {
  const link = (
    <ExternalLink href="https://docs.sentry.io/product/session-replay/getting-started/" />
  );
  return (
    <Alert icon={<IconInfo />}>
      <strong>{t(`Session Replay isn't available for %s.`, projectSlug)}</strong>{' '}
      {tct(`To learn more about which SDKs we support, please visit our [link:docs].`, {
        link,
      })}
    </Alert>
  );
}

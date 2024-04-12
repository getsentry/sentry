import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

interface Props {
  projectSlug: string;
}

export default function ReplayUnsupportedAlert({projectSlug}: Props) {
  const docsLink = (
    <ExternalLink href="https://docs.sentry.io/product/session-replay/getting-started/#supported-sdks" />
  );
  const waitlistLink = <ExternalLink href="https://sentry.io/lp/mobile-replay-beta/" />;
  return (
    <Alert icon={<IconInfo />}>
      <strong>{t(`Session Replay isn't available for %s.`, projectSlug)}</strong>{' '}
      {tct(
        `Currently, [docsLink:Web is supported], and Mobile is being developed. Join our [waitlistLink:waitlist].`,
        {
          docsLink,
          waitlistLink,
        }
      )}
    </Alert>
  );
}

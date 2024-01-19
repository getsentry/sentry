import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';

interface Props {
  orgSlug: string;
}

export default function MissingReplayAlert({orgSlug}: Props) {
  const reasons = [
    t('The replay is still processing'),
    tct(
      'The replay was rate-limited and could not be accepted. [link:View the stats page] for more information.',
      {
        link: <Link to={`/organizations/${orgSlug}/stats/?dataCategory=replays`} />,
      }
    ),
    t('The replay has been deleted by a member in your organization.'),
    t('There were network errors and the replay was not saved.'),
    tct('[link:Read the docs] to understand why.', {
      link: (
        <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/#error-linking" />
      ),
    }),
  ];

  return (
    <Alert
      type="info"
      showIcon
      data-test-id="replay-error"
      trailingItems={
        <LinkButton
          external
          href="https://docs.sentry.io/platforms/javascript/session-replay/#error-linking"
          size="xs"
        >
          {t('Read Docs')}
        </LinkButton>
      }
    >
      <p>
        {t(
          'The replay for this event cannot be found. This could be due to these reasons:'
        )}
      </p>
      <List symbol="bullet">
        {reasons.map((reason, i) => (
          <ListItem key={i}>{reason}</ListItem>
        ))}
      </List>
    </Alert>
  );
}

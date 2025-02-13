import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
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
    t('The replay is still processing.'),
    tct(
      'The replay was rate-limited and could not be accepted. [link:View the stats page] for more information.',
      {
        link: <Link to={`/organizations/${orgSlug}/stats/?dataCategory=replays`} />,
      }
    ),
    t('The replay has been deleted by a member in your organization.'),
    t('There were network errors and the replay was not saved.'),
    tct(
      "An ad-blocker was turned on for the user's session. [link:Read our docs] for a workaround.",
      {
        link: (
          <ExternalLink
            href={
              'https://docs.sentry.io/platforms/javascript/troubleshooting/#dealing-with-ad-blockers'
            }
          />
        ),
      }
    ),
  ];
  return (
    <Alert.Container>
      <Alert
        margin
        type="info"
        showIcon
        data-test-id="replay-error"
        expand={
          <Fragment>
            <ListIntro>{t('Other reasons may include:')}</ListIntro>
            <List symbol="bullet">
              {reasons.map((reason, i) => (
                <ListItem key={i}>{reason}</ListItem>
              ))}
            </List>
          </Fragment>
        }
      >
        {tct(
          "The replay associated with this event cannot be found. In most cases, the replay wasn't accepted because your replay quota was exceeded at the time. To learn more, [link:read our docs].",
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/#error-linking" />
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}

const ListIntro = styled('div')`
  line-height: 2em;
`;

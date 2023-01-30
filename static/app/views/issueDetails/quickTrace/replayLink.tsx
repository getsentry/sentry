import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {Event, Organization} from 'sentry/types';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';
import LinkContainer from 'sentry/views/issueDetails/linkContainer';

type Props = {
  organization: Organization;
  projectSlug: string;
  replayId: string;
  event?: Event;
};

function ReplayLink({organization, projectSlug, replayId, event}: Props) {
  const routes = useRoutes();

  const replaySlug = `${projectSlug}:${replayId}`;
  const fullReplayUrl = {
    pathname: `/organizations/${organization.slug}/replays/${replaySlug}/`,
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: 'console',
      event_t: event?.dateCreated,
    },
  };

  return (
    <LinkContainer>
      <Link to={fullReplayUrl}>{t('View Replay')}</Link>
    </LinkContainer>
  );
}

export default ReplayLink;

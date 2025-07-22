import AnalyticsArea from 'sentry/components/analyticsArea';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

type Props = RouteComponentProps & {
  children: React.ReactNode;
};

export default function ReplaysContainer({children}: Props) {
  const organization = useOrganization();

  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/replays/',
    newPathPrefix: '/explore/replays/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <AnalyticsArea name="replays">
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </AnalyticsArea>
  );
}

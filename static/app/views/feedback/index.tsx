import AnalyticsArea from 'sentry/components/analyticsArea';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

type Props = RouteComponentProps & {
  children: React.ReactNode;
};

export default function FeedbackContainer({children}: Props) {
  const organization = useOrganization();

  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/feedback/',
    newPathPrefix: '/issues/feedback/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <AnalyticsArea name="feedback">
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </AnalyticsArea>
  );
}

import {Outlet} from 'react-router-dom';

import AnalyticsArea from 'sentry/components/analyticsArea';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

export default function FeedbackContainer() {
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
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </AnalyticsArea>
  );
}

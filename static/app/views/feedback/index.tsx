import {Outlet} from 'react-router-dom';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Redirect} from 'sentry/components/redirect';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

export default function FeedbackContainer() {
  const organization = useOrganization();

  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/feedback/',
    newPathPrefix: '/issues/feedback/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <AnalyticsArea name="feedback">
      <Layout.Page>
        <NoProjectMessage organization={organization}>
          <Outlet />
        </NoProjectMessage>
      </Layout.Page>
    </AnalyticsArea>
  );
}

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import AnalyticsArea from 'sentry/components/analyticsArea';
import * as Layout from 'sentry/components/layouts/thirds';
import {useRedirectNavV2Routes} from 'sentry/components/nav/useRedirectNavV2Routes';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';

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
    <Feature
      features="user-feedback-ui"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <AnalyticsArea name="feedback">
        <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
      </AnalyticsArea>
    </Feature>
  );
}

function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert.Container>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Alert.Container>
    </Layout.Page>
  );
}

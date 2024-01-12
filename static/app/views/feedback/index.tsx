import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactNode;
};

export default function FeedbackContainer({children}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features="user-feedback-ui"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>
        <FloatingFeedbackWidget />
        {children}
      </NoProjectMessage>
    </Feature>
  );
}

function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

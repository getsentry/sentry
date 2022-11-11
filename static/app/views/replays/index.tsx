import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import type {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactChildren;
  organization: Organization;
};

function ReplaysContainer({organization, children}: Props) {
  function renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  return (
    <Feature
      features={['session-replay-ui']}
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      {children}
    </Feature>
  );
}

export default withOrganization(ReplaysContainer);

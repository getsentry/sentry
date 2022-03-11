import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, PageFilters} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactChildren;
  organization: Organization;
  selection: PageFilters;
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
      features={['session-replay']}
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      {children}
    </Feature>
  );
}

export default withPageFilters(withOrganization(ReplaysContainer));

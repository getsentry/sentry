import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import useOrganization from 'sentry/utils/useOrganization';

import GroupReplays from './groupReplays';

const GroupReplaysContainer = (props: React.ComponentProps<typeof GroupReplays>) => {
  const organization = useOrganization();
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
      <GroupReplays {...props} />
    </Feature>
  );
};

export default GroupReplaysContainer;

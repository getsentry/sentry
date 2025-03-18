import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

import GroupReplays from './groupReplays';

function renderNoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert.Container>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Alert.Container>
    </Layout.Page>
  );
}

function GroupReplaysWithGroup() {
  const params = useParams<{groupId: string}>();
  const {data: group, isPending, isError, refetch} = useGroup({groupId: params.groupId});

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return <GroupReplays group={group} />;
}

function GroupReplaysContainer() {
  const organization = useOrganization();

  return (
    <Feature
      features="session-replay"
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <GroupReplaysWithGroup />
    </Feature>
  );
}

export default GroupReplaysContainer;

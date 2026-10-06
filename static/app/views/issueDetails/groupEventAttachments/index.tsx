import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

import {GroupEventAttachments} from './groupEventAttachments';

function GroupEventAttachmentsContainer() {
  const organization = useOrganization();
  const params = useParams();

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId!});

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  return (
    <Feature
      features="event-attachments"
      organization={organization}
      renderDisabled={props => (
        <FeatureDisabled {...props} featureName={t('Event Attachments')} />
      )}
    >
      <Layout.Body border="primary" radius="md" padding={{zero: 'xl 0', '3xs': 'xl'}}>
        <Layout.Main width="full">
          <GroupEventAttachments project={group.project} group={group} />
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

export default GroupEventAttachmentsContainer;

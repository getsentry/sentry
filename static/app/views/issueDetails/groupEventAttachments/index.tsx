import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';

import GroupEventAttachments from './groupEventAttachments';

type Props = RouteComponentProps<{groupId: string}, {}> & {
  group: Group;
};

function GroupEventAttachmentsContainer({group}: Props) {
  const organization = useOrganization();
  return (
    <Feature
      features="event-attachments"
      organization={organization}
      renderDisabled={props => (
        <FeatureDisabled {...props} featureName={t('Event Attachments')} />
      )}
    >
      <Layout.Body>
        <Layout.Main fullWidth>
          <GroupEventAttachments project={group.project} groupId={group.id} />
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

export default GroupEventAttachmentsContainer;

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import GroupEventAttachments from './groupEventAttachments';

type Props = RouteComponentProps<{groupId: string}, {}> & {
  group: Group;
  organization: Organization;
};

function GroupEventAttachmentsContainer({organization, group}: Props) {
  return (
    <Feature
      features="event-attachments"
      organization={organization}
      renderDisabled={props => (
        <FeatureDisabled {...props} featureName={t('Event Attachments')} />
      )}
    >
      <GroupEventAttachments project={group.project} />
    </Feature>
  );
}

export default withOrganization(GroupEventAttachmentsContainer);

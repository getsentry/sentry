import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import {Group, Organization} from 'sentry/types';
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

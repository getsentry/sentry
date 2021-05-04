import {RouteComponentProps} from 'react-router';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {Group, Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import GroupEventAttachments from './groupEventAttachments';

type Props = RouteComponentProps<{orgId: string; groupId: string}, {}> & {
  organization: Organization;
  group: Group;
};

const GroupEventAttachmentsContainer = ({organization, group}: Props) => (
  <Feature
    features={['event-attachments']}
    organization={organization}
    renderDisabled={props => <FeatureDisabled {...props} />}
  >
    <GroupEventAttachments projectSlug={group.project.slug} />
  </Feature>
);

export default withOrganization(GroupEventAttachmentsContainer);

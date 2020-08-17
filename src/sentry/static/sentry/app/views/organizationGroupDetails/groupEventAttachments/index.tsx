import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Organization, Group} from 'app/types';
import Feature from 'app/components/acl/feature';
import withOrganization from 'app/utils/withOrganization';
import FeatureDisabled from 'app/components/acl/featureDisabled';

import GroupEventAttachments from './groupEventAttachments';

type Props = RouteComponentProps<{orgId: string; groupId: string}, {}> & {
  organization: Organization;
  group: Group;
};

const GroupEventAttachmentsContainer = ({organization, group, ...otherProps}: Props) => (
  <Feature
    features={['event-attachments']}
    organization={organization}
    renderDisabled={props => <FeatureDisabled {...props} />}
  >
    <GroupEventAttachments projectSlug={group.project.slug} {...otherProps} />
  </Feature>
);

export default withOrganization(GroupEventAttachmentsContainer);

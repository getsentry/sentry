import {RouteComponentProps} from 'react-router';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Group, Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import Grouping from './grouping';

type Props = RouteComponentProps<{}, {}> & {
  organization: Organization;
  group: Group;
  project: Project;
};

function GroupingContainer({organization, location, group, router, project}: Props) {
  return (
    <Feature
      features={['grouping-tree-ui']}
      organization={organization}
      renderDisabled={() => (
        <PageContent>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </PageContent>
      )}
    >
      <Grouping
        location={location}
        groupId={group.id}
        organization={organization}
        router={router}
        projSlug={project.slug}
      />
    </Feature>
  );
}

export default withOrganization(GroupingContainer);

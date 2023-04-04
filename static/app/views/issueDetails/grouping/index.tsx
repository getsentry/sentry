import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Group, Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import Grouping from './grouping';

type Props = RouteComponentProps<{}, {}> & {
  group: Group;
  organization: Organization;
  project: Project;
};

const GroupingContainer = ({organization, location, group, router, project}: Props) => {
  return (
    <Feature
      features={['grouping-tree-ui']}
      organization={organization}
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </Layout.Page>
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
};

export default withOrganization(GroupingContainer);

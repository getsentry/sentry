import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import type {Group, Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import Grouping from './grouping';

type Props = RouteComponentProps<{}, {}> & {
  group: Group;
  organization: Organization;
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

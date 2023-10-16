import {RouteComponentProps} from 'react-router';

import {Organization, PageFilters, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';

import Header from '../components/header';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

function ReleaseThresholdList({router, organization}: Props) {
  const hasV2ReleaseUIEnabled = organization.features.includes('release-ui-v2');
  if (!hasV2ReleaseUIEnabled) {
    router.replace('/releases/');
  }

  return (
    <div>
      <Header router={router} hasV2ReleaseUIEnabled />
    </div>
  );
}

export default withProjects(withOrganization(withPageFilters(ReleaseThresholdList)));

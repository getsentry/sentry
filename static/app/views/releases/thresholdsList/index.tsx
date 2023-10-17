import {useEffect} from 'react';
import {RouteComponentProps} from 'react-router';

// import {Organization, PageFilters, Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

// import usePageFilters from 'sentry/utils/usePageFilters';
// import useProjects from 'sentry/utils/useProjects';
// import useRouter from 'sentry/utils/useRouter';
import Header from '../components/header';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {};

function ReleaseThresholdList({router}: Props) {
  const organization = useOrganization();
  useEffect(() => {
    const hasV2ReleaseUIEnabled = organization.features.includes('release-ui-v2');
    if (!hasV2ReleaseUIEnabled) {
      router.replace('/releases/');
    }
  }, [router, organization]);
  // const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  // const {selection, isReady, desyncedFilters} = usePageFilters();

  return (
    <div>
      <Header router={router} hasV2ReleaseUIEnabled />
    </div>
  );
}

export default ReleaseThresholdList;

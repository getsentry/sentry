import {useEffect, useState} from 'react';
import {Outlet, useOutletContext} from 'react-router-dom';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Member} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import useScrollToTop from 'sentry/utils/useScrollToTop';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

type AlertBuilderOutletContext = {
  members: Member[] | undefined;
  project: Project;
};

function AlertBuilderOutlet(props: AlertBuilderOutletContext) {
  return <Outlet context={props} />;
}

export function useAlertBuilderOutlet() {
  return useOutletContext<AlertBuilderOutletContext>();
}

export default function AlertBuilderProjectProvider() {
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<{projectId?: string}>();
  const router = useRouter();
  const isMountedRef = useIsMountedRef();
  const [members, setMembers] = useState<Member[] | undefined>(undefined);
  useScrollToTop({location});

  const projectId = params.projectId || decodeScalar(location.query.project);
  const useFirstProject = projectId === undefined;

  const {projects, initiallyLoaded, fetching, fetchError} = useProjects();
  const project = useFirstProject
    ? (projects.find(p => p.isMember) ?? (projects.length && projects[0]))
    : projects.find(({slug}) => slug === projectId);

  useEffect(() => {
    if (!project) {
      return;
    }

    // fetch members list for mail action fields
    fetchOrgMembers(api, organization.slug, [project.id]).then(mem => {
      if (isMountedRef.current) {
        setMembers(mem);
      }
    });
  }, [api, organization, isMountedRef, project]);

  if (!initiallyLoaded || fetching) {
    return <LoadingIndicator />;
  }

  // If there's no project show the project selector modal
  if (!project && !fetchError) {
    navigateTo(
      makeAlertsPathname({
        path: '/wizard/',
        organization,
      }) + `?referrer=${location.query.referrer}&project=:projectId`,
      router
    );
  }

  // if loaded, but project fetching states incomplete or project can't be found, project doesn't exist
  if (!project || fetchError) {
    return (
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t('The project you were looking for was not found.')}
        </Alert>
      </Alert.Container>
    );
  }

  return <AlertBuilderOutlet project={project} members={members} />;
}

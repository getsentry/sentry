import {Outlet, useOutletContext} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Member} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {useScrollToTop} from 'sentry/utils/useScrollToTop';
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
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<{projectId?: string}>();
  const navigate = useNavigate();
  useScrollToTop({location});

  const projectId = params.projectId || decodeScalar(location.query.project);
  const useFirstProject = projectId === undefined;

  const {projects, initiallyLoaded, fetching, fetchError} = useProjects();
  const project = useFirstProject
    ? (projects.find(p => p.isMember) ?? (projects.length && projects[0]))
    : projects.find(({slug}) => slug === projectId);

  const {data: members} = useQuery({
    ...useProjectMembersQueryOptions(project ? [project.id] : undefined),
    enabled: Boolean(project),
  });

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
      navigate,
      location
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

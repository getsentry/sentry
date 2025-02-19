import {cloneElement, Fragment, isValidElement, useEffect, useState} from 'react';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Member, Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';
import useProjects from 'sentry/utils/useProjects';
import useScrollToTop from 'sentry/utils/useScrollToTop';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

type Props = RouteComponentProps<RouteParams> & {
  hasMetricAlerts: boolean;
  organization: Organization;
  children?: React.ReactNode;
};

type RouteParams = {
  projectId?: string;
};

function AlertBuilderProjectProvider(props: Props) {
  const api = useApi();
  const isMountedRef = useIsMountedRef();
  const [members, setMembers] = useState<Member[] | undefined>(undefined);
  useScrollToTop({location: props.location});

  const {children, params, organization, ...other} = props;
  const projectId = params.projectId || props.location.query.project;
  const useFirstProject = projectId === undefined;

  const {projects, initiallyLoaded, fetching, fetchError} = useProjects();
  const project = useFirstProject
    ? projects.find(p => p.isMember) ?? (projects.length && projects[0])
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
      }) + `?referrer=${props.location.query.referrer}&project=:projectId`,
      props.router
    );
  }

  // if loaded, but project fetching states incomplete or project can't be found, project doesn't exist
  if (!project || fetchError) {
    return (
      <Alert.Container>
        <Alert type="warning">
          {t('The project you were looking for was not found.')}
        </Alert>
      </Alert.Container>
    );
  }

  return (
    <Fragment>
      {children && isValidElement(children)
        ? cloneElement(children, {
            ...other,
            ...children.props,
            project,
            projectId: useFirstProject ? project.slug : projectId,
            organization,
            members,
          })
        : children}
    </Fragment>
  );
}

export default AlertBuilderProjectProvider;

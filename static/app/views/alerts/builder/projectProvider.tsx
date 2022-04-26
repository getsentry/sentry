import {cloneElement, isValidElement, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import Alert from 'sentry/components/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';
import useScrollToTop from 'sentry/utils/useScrollToTop';

type Props = RouteComponentProps<RouteParams, {}> & {
  hasMetricAlerts: boolean;
  organization: Organization;
  children?: React.ReactNode;
};

type RouteParams = {
  projectId?: string;
};

function AlertBuilderProjectProvider(props: Props) {
  const api = useApi();
  useScrollToTop({location: props.location});

  const {children, params, organization, ...other} = props;
  const projectId = params.projectId || props.location.query.project;
  const hasAlertWizardV3 = organization.features.includes('alert-wizard-v3');
  const useFirstProject = hasAlertWizardV3 && projectId === undefined;

  // calling useProjects() without args fetches all projects
  const {projects, initiallyLoaded, fetching, fetchError} = useProjects(
    useFirstProject
      ? undefined
      : {
          slugs: [projectId],
        }
  );
  const project = useFirstProject
    ? projects.find(p => p)
    : projects.find(({slug}) => slug === projectId);

  useEffect(() => {
    if (!project) {
      return;
    }

    // fetch members list for mail action fields
    fetchOrgMembers(api, organization.slug, [project.id]);
  }, [project]);

  if (!initiallyLoaded || fetching) {
    return <LoadingIndicator />;
  }

  // if loaded, but project fetching states incomplete or project can't be found, project doesn't exist
  if (!project || fetchError) {
    return (
      <Alert type="warning">{t('The project you were looking for was not found.')}</Alert>
    );
  }

  return children && isValidElement(children)
    ? cloneElement(children, {
        ...other,
        ...children.props,
        project,
        projectId: useFirstProject ? project.slug : projectId,
        organization,
      })
    : children;
}

export default AlertBuilderProjectProvider;

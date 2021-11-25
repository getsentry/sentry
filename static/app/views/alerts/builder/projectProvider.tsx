import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import Alert from 'sentry/components/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import Projects from 'sentry/utils/projects';
import useApi from 'sentry/utils/useApi';
import ScrollToTop from 'sentry/views/settings/components/scrollToTop';

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  children?: React.ReactNode;
  hasMetricAlerts: boolean;
};

type RouteParams = {
  projectId: string;
};

function AlertBuilderProjectProvider(props: Props) {
  const api = useApi();

  const {children, params, organization, ...other} = props;
  const {projectId} = params;

  return (
    <Projects orgId={organization.slug} allProjects>
      {({projects, initiallyLoaded, isIncomplete}) => {
        if (!initiallyLoaded) {
          return <LoadingIndicator />;
        }
        const project = (projects as Project[]).find(({slug}) => slug === projectId);
        // if loaded, but project fetching states incomplete or project can't be found, project doesn't exist
        if (isIncomplete || !project) {
          return (
            <Alert type="warning">
              {t('The project you were looking for was not found.')}
            </Alert>
          );
        }
        // fetch members list for mail action fields
        fetchOrgMembers(api, organization.slug, [project.id]);

        return (
          <ScrollToTop location={props.location} disable={() => false}>
            {children && React.isValidElement(children)
              ? React.cloneElement(children, {
                  ...other,
                  ...children.props,
                  project,
                  organization,
                })
              : children}
          </ScrollToTop>
        );
      }}
    </Projects>
  );
}

export default AlertBuilderProjectProvider;

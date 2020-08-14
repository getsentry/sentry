import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Organization, Project} from 'app/types';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import LoadingIndicator from 'app/components/loadingIndicator';
import Projects from 'app/utils/projects';

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  children?: React.ReactNode;
  hasMetricAlerts: boolean;
};

type RouteParams = {
  projectId: string;
};

function AlertBuilderProjectProvider(props: Props) {
  const {children, params, organization, hasMetricAlerts} = props;
  const {projectId} = params;
  return (
    <Projects orgId={organization.slug} slugs={[projectId]}>
      {({projects, initiallyLoaded, isIncomplete}) => {
        if (!initiallyLoaded) {
          return <LoadingIndicator />;
        }
        // if loaded, but project fetching states incomplete, project doesn't exist
        if (isIncomplete) {
          return (
            <Alert type="warning">
              {t('The project you were looking for was not found.')}
            </Alert>
          );
        }
        const project = projects[0] as Project;
        return (
          <React.Fragment>
            {children && React.isValidElement(children)
              ? React.cloneElement(children, {
                  project,
                  organization,
                  hasMetricAlerts,
                })
              : children}
          </React.Fragment>
        );
      }}
    </Projects>
  );
}

export default AlertBuilderProjectProvider;

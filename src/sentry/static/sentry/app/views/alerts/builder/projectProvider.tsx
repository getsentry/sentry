import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {t} from 'app/locale';
import {fetchOrgMembers} from 'app/actionCreators/members';
import Alert from 'app/components/alert';
import LoadingIndicator from 'app/components/loadingIndicator';
import Projects from 'app/utils/projects';
import withApi from 'app/utils/withApi';

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  api: Client;
  children?: React.ReactNode;
  hasMetricAlerts: boolean;
};

type RouteParams = {
  projectId: string;
};

function AlertBuilderProjectProvider(props: Props) {
  const {children, params, organization, api, ...other} = props;
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

        // fetch members list for mail action fields
        fetchOrgMembers(api, organization.slug, [Number(project.id)]);

        return (
          <React.Fragment>
            {children && React.isValidElement(children)
              ? React.cloneElement(children, {
                  ...other,
                  ...children.props,
                  project,
                  organization,
                })
              : children}
          </React.Fragment>
        );
      }}
    </Projects>
  );
}

export default withApi(AlertBuilderProjectProvider);

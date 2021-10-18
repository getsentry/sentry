import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import {fetchOrgMembers} from 'app/actionCreators/members';
import Alert from 'app/components/alert';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import Projects from 'app/utils/projects';
import useApi from 'app/utils/useApi';
import ScrollToTop from 'app/views/settings/components/scrollToTop';

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

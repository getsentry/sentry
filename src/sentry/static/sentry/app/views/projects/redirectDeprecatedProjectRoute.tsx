import React from 'react';
import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isString from 'lodash/isString';

import {Client} from 'app/api';
import Alert from 'app/components/alert';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Project} from 'app/types';
import {analytics} from 'app/utils/analytics';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import Redirect from 'app/utils/redirect';
import withApi from 'app/utils/withApi';

type DetailsProps = {
  api: Client;
  orgId: string;
  projectSlug: string;
  children: (props: ChildProps) => React.ReactNode;
};

type DetailsState = {
  loading: boolean;
  error: null | JQueryXHR;
  project: null | Project;
};

type ChildProps = DetailsState & {
  projectId: null | string;
  organizationId: null | string;
  hasProjectId: boolean;
};

class ProjectDetailsInner extends React.Component<DetailsProps, DetailsState> {
  state: DetailsState = {
    loading: true,
    error: null,
    project: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    this.setState({
      loading: true,
      error: null,
    });

    const {orgId, projectSlug} = this.props;

    try {
      const project = await this.props.api.requestPromise(
        `/projects/${orgId}/${projectSlug}/`
      );

      this.setState({
        loading: false,
        error: null,
        project,
      });
    } catch (error) {
      this.setState({
        loading: false,
        error,
        project: null,
      });
    }
  };

  getProjectId() {
    if (this.state.project) {
      return this.state.project.id;
    }
    return null;
  }

  hasProjectId() {
    const projectID = this.getProjectId();
    return isString(projectID) && projectID.length > 0;
  }

  getOrganizationId() {
    if (this.state.project) {
      return this.state.project.organization.id;
    }
    return null;
  }

  render() {
    const childrenProps: ChildProps = {
      ...this.state,
      projectId: this.getProjectId(),
      hasProjectId: this.hasProjectId(),
      organizationId: this.getOrganizationId(),
    };

    return this.props.children(childrenProps);
  }
}

const ProjectDetails = withApi(ProjectDetailsInner);

type Props = WithRouterProps<{orgId: string; projectId: string}> & {
  location: Location;
};

type RedirectOptions = {
  orgId: string;
  projectId: null | string;
};

type RedirectCallback = (options: RedirectOptions) => string;

const redirectDeprecatedProjectRoute = (generateRedirectRoute: RedirectCallback) => {
  class RedirectDeprecatedProjectRoute extends React.Component<Props> {
    trackRedirect = (organizationId: string, nextRoute: string) => {
      const payload = {
        feature: 'global_views',
        url: getRouteStringFromRoutes(this.props.routes), // the URL being redirected from
        org_id: parseInt(organizationId, 10),
      };

      // track redirects of deprecated URLs for analytics
      analytics('deprecated_urls.redirect', payload);

      return nextRoute;
    };

    render() {
      const {orgId} = this.props.params;

      return (
        <Wrapper>
          <ProjectDetails orgId={orgId} projectSlug={this.props.params.projectId}>
            {({loading, error, hasProjectId, projectId, organizationId}) => {
              if (loading) {
                return <LoadingIndicator />;
              }

              if (!hasProjectId || !organizationId) {
                if (error && error.status === 404) {
                  return (
                    <Alert type="error">
                      {t('The project you were looking for was not found.')}
                    </Alert>
                  );
                }

                return <LoadingError />;
              }

              const routeProps = {
                orgId,
                projectId,
                router: {
                  params: this.props.params,
                },
              };

              return (
                <Redirect
                  router={this.props.router}
                  to={this.trackRedirect(
                    organizationId,
                    generateRedirectRoute(routeProps)
                  )}
                />
              );
            }}
          </ProjectDetails>
        </Wrapper>
      );
    }
  }

  return RedirectDeprecatedProjectRoute;
};

export default redirectDeprecatedProjectRoute;

const Wrapper = styled('div')`
  flex: 1;
  padding: ${space(3)};
`;

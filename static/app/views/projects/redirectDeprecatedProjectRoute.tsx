import {Component} from 'react';
import styled from '@emotion/styled';

import type {Client, ResponseMeta} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import withApi from 'sentry/utils/withApi';

type DetailsProps = {
  api: Client;
  children: (props: ChildProps) => React.ReactNode;
  orgId: string;
  projectSlug: string;
};

type DetailsState = {
  error: null | ResponseMeta;
  loading: boolean;
  project: null | Project;
};

type ChildProps = DetailsState & {
  hasProjectId: boolean;
  organizationId: null | string;
  projectId: null | string;
};

class ProjectDetailsInner extends Component<DetailsProps, DetailsState> {
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
    return typeof projectID === 'string' && projectID.length > 0;
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

type Params = {orgId: string; projectId: string} & Record<string, any>;

type Props = RouteComponentProps<Params>;

type RedirectOptions = {
  orgId: string;
  projectId: null | string;
  router: {
    params: Params;
  };
};

type RedirectCallback = (options: RedirectOptions) => string;

const redirectDeprecatedProjectRoute = (generateRedirectRoute: RedirectCallback) =>
  function ({params, router, routes}: Props) {
    // TODO(epurkhiser): The way this function get's called as a side-effect of
    // the render is pretty janky and incorrect... we should fix it.
    function trackRedirect(organizationId: string, nextRoute: string) {
      const payload = {
        feature: 'global_views',
        url: getRouteStringFromRoutes(routes), // the URL being redirected from
        organization: organizationId,
      };

      // track redirects of deprecated URLs for analytics
      trackAnalytics('deprecated_urls.redirect', payload);
      return nextRoute;
    }

    const {orgId} = params;

    return (
      <Wrapper>
        <ProjectDetails orgId={orgId} projectSlug={params.projectId}>
          {({loading, error, hasProjectId, projectId, organizationId}) => {
            if (loading) {
              return <LoadingIndicator />;
            }

            if (!hasProjectId || !organizationId) {
              if (error && error.status === 404) {
                return (
                  <Alert.Container>
                    <Alert type="error">
                      {t('The project you were looking for was not found.')}
                    </Alert>
                  </Alert.Container>
                );
              }

              return <LoadingError />;
            }

            const routeProps: RedirectOptions = {
              orgId,
              projectId,
              router: {params},
            };

            return (
              <Redirect
                router={router}
                to={trackRedirect(organizationId, generateRedirectRoute(routeProps))}
              />
            );
          }}
        </ProjectDetails>
      </Wrapper>
    );
  };

export default redirectDeprecatedProjectRoute;

const Wrapper = styled('div')`
  flex: 1;
  padding: ${space(3)};
`;

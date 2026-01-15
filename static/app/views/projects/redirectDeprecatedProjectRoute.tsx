import {Component} from 'react';
import styled from '@emotion/styled';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import withApi from 'sentry/utils/withApi';

type DetailsProps = {
  api: Client;
  children: (props: ChildProps) => React.ReactNode;
  orgId: string;
  projectSlug: string;
};

type DetailsState = {
  error: null | RequestError;
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
        error: error as RequestError,
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

type RedirectOptions = {
  orgId: string;
  projectId: null | string;
};

type RedirectCallback = (options: RedirectOptions) => string;

const redirectDeprecatedProjectRoute = (generateRedirectRoute: RedirectCallback) =>
  function RedirectDeprecatedProjectRoute() {
    const params = useParams<{orgId: string; projectId: string}>();
    const location = useLocation();

    // TODO(epurkhiser): The way this function gets called as a side-effect of
    // the render is pretty janky and incorrect... we should fix it.
    function trackRedirect(organizationId: string, nextRoute: string) {
      const payload = {
        feature: 'global_views',
        url: location.pathname, // the URL being redirected from
        organization: organizationId,
      };

      // track redirects of deprecated URLs for analytics
      trackAnalytics('deprecated_urls.redirect', payload);
      return nextRoute;
    }

    const {orgId, projectId: projectSlug} = params;

    return (
      <Wrapper>
        <ProjectDetails orgId={orgId} projectSlug={projectSlug}>
          {({loading, error, hasProjectId, projectId, organizationId}) => {
            if (loading) {
              return <LoadingIndicator />;
            }

            if (!hasProjectId || !organizationId) {
              if (error && error.status === 404) {
                return (
                  <Alert.Container>
                    <Alert variant="danger" showIcon={false}>
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
            };

            return <Redirect to={trackRedirect(organizationId, generateRedirectRoute(routeProps))} />;
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

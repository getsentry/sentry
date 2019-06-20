import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import LoadingError from 'app/components/loadingError';
import {analytics} from 'app/utils/analytics';
import Alert from 'app/components/alert';
import Redirect from 'app/utils/redirect';

class ProjectDetailsInner extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,

    orgId: PropTypes.string.isRequired,
    projectSlug: PropTypes.string.isRequired,
  };

  state = {
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

  getProjectId = () => {
    return this.state.project?.id;
  };

  hasProjectId = () => {
    const projectID = this.getProjectId(this.state.project);
    return _.isString(projectID) && projectID.length > 0;
  };

  getOrganizationId = () => {
    return this.state.project?.organization?.id;
  };

  render() {
    const childrenProps = {
      ...this.state,
      projectId: this.getProjectId(),
      hasProjectId: this.hasProjectId(),
      organizationId: this.getOrganizationId(),
    };

    return this.props.children(childrenProps);
  }
}

export const ProjectDetails = withApi(ProjectDetailsInner);

const redirectDeprecatedProjectRoute = generateRedirectRoute => {
  class RedirectDeprecatedProjectRoute extends React.Component {
    static propTypes = {
      router: PropTypes.object.isRequired,

      location: PropTypes.shape({
        pathname: PropTypes.string.isRequired,
        search: PropTypes.string.isRequired,
      }).isRequired,

      params: PropTypes.shape({
        orgId: PropTypes.string.isRequired,
        projectId: PropTypes.string.isRequired,
      }).isRequired,
    };

    trackRedirect = (organizationId, nextRoute) => {
      const {pathname, search} = this.props.location;

      const payload = {
        feature: 'global_views',
        url: `${pathname}${search}`, // the URL being redirected from
        org_id: parseInt(organizationId, 10),
      };

      console.log('payload', payload);

      // track redirects of deprecated URLs for analytics
      analytics('deprecated_urls.redirect', payload);

      return nextRoute;
    };

    render() {
      const {orgId} = this.props.params;

      return (
        <ProjectDetails orgId={orgId} projectSlug={this.props.params.projectId}>
          {({loading, error, hasProjectId, projectId, organizationId}) => {
            if (loading) {
              return null;
            }

            if (!hasProjectId) {
              if (error?.status === 404) {
                return (
                  <Alert type="error">
                    {t('The project you were looking for was not found.')}
                  </Alert>
                );
              }

              return <LoadingError onRetry={this.fetchData} />;
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
                to={this.trackRedirect(organizationId, generateRedirectRoute(routeProps))}
              />
            );
          }}
        </ProjectDetails>
      );
    }
  }

  return RedirectDeprecatedProjectRoute;
};

export default redirectDeprecatedProjectRoute;

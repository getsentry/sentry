import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import LoadingError from 'app/components/loadingError';

// TODO: This is react-router v4 <Redirect to="path/" /> component to allow things
//       to be declarative
export class Redirect extends React.Component {
  static propTypes = {
    router: PropTypes.object.isRequired,
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  };

  componentDidMount() {
    this.props.router.replace(this.props.to);
  }

  render() {
    return null;
  }
}

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

  render() {
    const childrenProps = {
      ...this.state,
      projectId: this.getProjectId(),
      hasProjectId: this.hasProjectId(),
    };

    return this.props.children(childrenProps);
  }
}

export const ProjectDetails = withApi(ProjectDetailsInner);

const redirectSentry9Project = generateRedirectRoute => {
  class RedirectSentry9Project extends React.Component {
    static propTypes = {
      router: PropTypes.object.isRequired,

      params: PropTypes.shape({
        orgId: PropTypes.string.isRequired,
        projectSlug: PropTypes.string.isRequired,
      }).isRequired,
    };

    render() {
      const {orgId, projectSlug} = this.props.params;

      return (
        <ProjectDetails
          router={this.props.router}
          orgId={orgId}
          projectSlug={projectSlug}
        >
          {({loading, error, hasProjectId, projectId}) => {
            if (loading) {
              return null;
            }

            if (!hasProjectId) {
              if (_.get(error, 'status') === 404) {
                return (
                  <div className="container">
                    <div className="alert alert-block" style={{margin: '30px 0 10px'}}>
                      {t('The project you were looking for was not found.')}
                    </div>
                  </div>
                );
              }

              return <LoadingError onRetry={this.fetchData} />;
            }

            const routeProps = {
              orgId,
              projectId,
              router: {
                params: {
                  ...this.props.params,
                },
              },
            };

            return (
              <Redirect
                router={this.props.router}
                to={generateRedirectRoute(routeProps)}
              />
            );
          }}
        </ProjectDetails>
      );
    }
  }

  return RedirectSentry9Project;
};

export default redirectSentry9Project;

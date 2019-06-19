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
    projectId: PropTypes.string.isRequired,
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

    const {orgId, projectId} = this.props;

    try {
      const projectRequest = this.props.api.requestPromise(
        `/projects/${orgId}/${projectId}/`
      );

      const project = await projectRequest;
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
    return _.get(this.state.project, 'id');
  };

  hasProjectId = () => {
    const projectID = this.getProjectId(this.state.project);
    return _.isString(projectID) && projectID.length > 0;
  };

  render() {
    const childrenProps = {
      ...this.state,
      getProjectId: this.getProjectId,
      hasProjectId: this.hasProjectId,
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
        projectId: PropTypes.string.isRequired,
      }).isRequired,
    };

    render() {
      const {orgId, projectId} = this.props.params;

      return (
        <ProjectDetails router={this.props.router} orgId={orgId} projectId={projectId}>
          {({loading, error, hasProjectId, getProjectId}) => {
            if (loading) {
              return null;
            }

            if (!hasProjectId()) {
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

            const currentProjectId = getProjectId();

            const routeProps = {
              orgId,
              projectId: currentProjectId,
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

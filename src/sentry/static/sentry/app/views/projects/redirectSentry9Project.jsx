import React from 'react';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import _ from 'lodash';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

// TODO: This is react-router v4 <Redirect to="path/" /> component to allow things
//       to be declarative
class Redirect extends React.Component {
  static propTypes = {
    router: PropTypes.object.isRequired,
    to: PropTypes.string.isRequired,
  };

  componentDidMount() {
    this.props.router.replace(this.props.to);
  }

  render() {
    return null;
  }
}

const redirectSentry9Project = generateRedirectRoute => {
  class RedirectSentry9Project extends React.Component {
    static propTypes = {
      router: PropTypes.object.isRequired,
      api: PropTypes.object,

      params: PropTypes.shape({
        orgId: PropTypes.string.isRequired,
        projectId: PropTypes.string.isRequired,
      }).isRequired,
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

      const {orgId, projectId} = this.props.params;

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
      if (this.state.loading) {
        return null;
      }

      if (!this.hasProjectId() || this.state.error) {
        return (
          <div className="container">
            <div className="alert alert-block" style={{margin: '30px 0 10px'}}>
              {t('The project you were looking for was not found.')}
            </div>
          </div>
        );
      }

      const currentProjectId = this.getProjectId();

      const routeProps = {
        orgId: this.props.params.orgId,
        projectId: currentProjectId,
        router: {
          params: {
            ...this.props.params,
          },
        },
      };

      return (
        <Redirect router={this.props.router} to={generateRedirectRoute(routeProps)} />
      );
    }
  }

  return withRouter(withApi(RedirectSentry9Project));
};

export default redirectSentry9Project;

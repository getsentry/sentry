import React from 'react';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import _ from 'lodash';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

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

    componentWillMount() {
      this.fetchData();
    }

    componentDidUpdate(prevProps, prevState) {
      const previousProjectId = this.getProjectId(prevState.project);
      const currentProjectId = this.getProjectId(this.state.project);
      const hasProjectId = this.hasProjectId(this.state.project);

      console.log('previousProjectId', previousProjectId);
      console.log('currentProjectId', currentProjectId);
      console.log('this.hasProjectId()', hasProjectId);

      if (
        previousProjectId !== currentProjectId &&
        hasProjectId &&
        this.state.loading === false
      ) {
        const routeProps = {
          orgId: this.props.params.orgId,
          projectId: currentProjectId,
        };

        this.props.router.replace(generateRedirectRoute(routeProps));
      }
    }

    fetchData = async () => {
      console.log('props', this.props);

      this.setState({
        loading: true,
        error: null,
      });

      const {orgId, projectId} = this.props.params;

      const projectRequest = this.props.api.requestPromise(
        `/projects/${orgId}/${projectId}/`
      );

      try {
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

    getProjectId = project => {
      return _.get(project, 'id');
    };

    hasProjectId = project => {
      const projectID = this.getProjectId(project);
      return _.isString(projectID) && projectID.length > 0;
    };

    render() {
      if (this.state.loading) {
        return null;
      }

      if (!this.hasProjectId(this.state.project)) {
        if (this.state.error) {
          // TODO: handle this
          return <div>error</div>;
        }

        return (
          <div className="container">
            <div className="alert alert-block" style={{margin: '30px 0 10px'}}>
              {t('The project you were looking for was not found.')}
            </div>
          </div>
        );
      }

      console.log('project', this.state.project);

      // TODO: flesh this out
      return <div>redirecting</div>;
    }
  }

  return withRouter(withApi(RedirectSentry9Project));
};

export default redirectSentry9Project;

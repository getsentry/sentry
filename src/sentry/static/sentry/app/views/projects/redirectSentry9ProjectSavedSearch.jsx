import React from 'react';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import _ from 'lodash';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import LoadingError from 'app/components/loadingError';
import {fetchProjectSavedSearches} from 'app/actionCreators/savedSearches';
import {ProjectDetails, Redirect} from './redirectSentry9Project';

const DEFAULT_SORT = 'date';
const DEFAULT_STATS_PERIOD = '24h';
const STATS_PERIODS = new Set(['14d', '24h']);

const redirectSentry9ProjectSavedSearch = generateRedirectRoute => {
  class RedirectSentry9ProjectSavedSearch extends React.Component {
    static propTypes = {
      router: PropTypes.object.isRequired,
      api: PropTypes.object.isRequired,

      params: PropTypes.shape({
        orgId: PropTypes.string.isRequired,
        projectId: PropTypes.string.isRequired,
        searchId: PropTypes.string.isRequired,
      }).isRequired,
    };

    state = {
      loading: true,
      error: null,
      savedSearch: null,
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
        const request = fetchProjectSavedSearches(this.props.api, orgId, projectId);

        const savedSearch = await request;
        this.setState({
          loading: false,
          error: null,
          savedSearch,
        });
      } catch (error) {
        this.setState({
          loading: false,
          error,
          savedSearch: null,
        });
      }
    };

    getSearchQuery = () => {
      const {savedSearch} = this.state;

      if (!_.isArray(savedSearch)) {
        return {};
      }

      const {searchId} = this.props.params;

      const searchQuery = savedSearch.find(search => search.id === searchId);

      if (!searchQuery) {
        return {};
      }

      const currentQuery = this.props.location.query || {};

      const queryParams = {
        sort: currentQuery.sort || DEFAULT_SORT,
        statsPeriod: STATS_PERIODS.has(currentQuery.statsPeriod)
          ? currentQuery.statsPeriod
          : DEFAULT_STATS_PERIOD,
      };

      if (searchQuery.query) {
        queryParams.query = searchQuery.query;
      }

      if (currentQuery.environment) {
        queryParams.environment = currentQuery.environment;
      }

      return queryParams;
    };

    render() {
      if (this.state.loading) {
        return null;
      }

      if (this.state.error) {
        if (_.get(this.state.error, 'status') === 404) {
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

      const {orgId, projectId} = this.props.params;

      return (
        <ProjectDetails orgId={orgId} projectId={projectId}>
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
              orgId: this.props.params.orgId,
              projectId: currentProjectId,
              router: {
                params: {
                  ...this.props.params,
                },
              },
              searchQuery: this.getSearchQuery(),
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

  return withRouter(withApi(RedirectSentry9ProjectSavedSearch));
};

export default redirectSentry9ProjectSavedSearch;

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import LoadingError from 'app/components/loadingError';
import {fetchProjectSavedSearches} from 'app/actionCreators/savedSearches';
import {analytics} from 'app/utils/analytics';
import Alert from 'app/components/alert';
import Redirect from 'app/utils/redirect';

import {ProjectDetails} from './redirectLegacyProjectRoute';

const DEFAULT_SORT = 'date';
const DEFAULT_STATS_PERIOD = '24h';
const STATS_PERIODS = new Set(['14d', '24h']);

const redirectLegacyProjectSavedSearchRoute = generateRedirectRoute => {
  class RedirectLegacyProjectSavedSearchRoute extends React.Component {
    static propTypes = {
      router: PropTypes.object.isRequired,

      api: PropTypes.object.isRequired,

      location: PropTypes.shape({
        pathname: PropTypes.string.isRequired,
        search: PropTypes.string.isRequired,
      }).isRequired,

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
        const savedSearch = await fetchProjectSavedSearches(
          this.props.api,
          orgId,
          projectId
        );
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

      const searchQuery = savedSearch.find(search => {
        const needle = search?.id;
        return needle === searchId;
      });

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
      if (this.state.loading) {
        return null;
      }

      if (this.state.error) {
        if (this.state.error?.status !== 404) {
          return <LoadingError onRetry={this.fetchData} />;
        }

        // invariant:
        // There was an error fetching a search query for the given projectId.
        // We can salvage the request by at least redirecting the user to the
        // issue stream filtered by the given projectId, if a project identified
        // by projectId exists.
      }

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
              orgId: this.props.params.orgId,
              projectId,
              router: {
                params: this.props.params,
              },
              searchQuery: this.getSearchQuery(),
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

  return withApi(RedirectLegacyProjectSavedSearchRoute);
};

export default redirectLegacyProjectSavedSearchRoute;

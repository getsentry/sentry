import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {browserHistory} from 'react-router';
import qs from 'query-string';

import LatestContextStore from '../stores/latestContextStore';

const withEnvironmentInQueryString = WrappedComponent =>
  createReactClass({
    displayName: 'withEnvironmentInQueryString',

    propTypes: {
      location: PropTypes.object,
    },

    mixins: [Reflux.listenTo(LatestContextStore, 'onLatestContextChange')],

    getInitialState() {
      const latestContext = LatestContextStore.getInitialState();
      return {
        environment: latestContext.environment,
        organization: latestContext.organization,
        hasEnvironmentsFeature: this.hasEnvironmentsFeature(latestContext.organization),
      };
    },

    componentWillMount() {
      if (this.state.hasEnvironmentsFeature) {
        const {query, pathname} = this.props.location;

        if (this.state.environment) {
          const envName = this.state.environment.name;
          const hasValidEnvironmentInQuery =
            'environment' in query && query.environment === envName;

          // Update environment in browser history if it is not in sync with the currently active one
          if (!hasValidEnvironmentInQuery) {
            query.environment = this.state.environment.name;
            browserHistory.replace(`${pathname}?${qs.stringify(query)}`);
          }
        }
      }
    },

    onLatestContextChange({environment, organization}) {
      // TODO(lyn): Remove this when environments feature is active
      const hasEnvironmentsFeature = this.hasEnvironmentsFeature(organization);

      if (hasEnvironmentsFeature && environment !== this.state.environment) {
        const {query, pathname} = this.props.location;
        if (environment) {
          query.environment = environment.name;
        } else {
          delete query.environment;
        }
        browserHistory.push(`${pathname}?${qs.stringify(query)}`);
      }

      this.setState({
        environment,
        organization,
        hasEnvironmentsFeature,
      });
    },

    hasEnvironmentsFeature(org) {
      const features = new Set(org ? org.features : []);
      return features.has('environments');
    },

    render() {
      const environment = this.state.hasEnvironmentsFeature
        ? this.state.environment
        : null;

      return <WrappedComponent environment={environment} {...this.props} />;
    },
  });

export default withEnvironmentInQueryString;

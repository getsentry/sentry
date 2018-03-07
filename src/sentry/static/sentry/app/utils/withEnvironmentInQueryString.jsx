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
          query.environment = this.state.environment.name;
        } else {
          delete query.environment;
        }
        browserHistory.replace(`${pathname}?${qs.stringify(query)}`);
      }
    },

    onLatestContextChange({environment, organization}) {
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

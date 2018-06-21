import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';

import ConfigStore from 'app/stores/configStore';
import SentryTypes from 'app/proptypes';

/**
 * Interface to handle feature tags as well as user's organization access levels
 */
class Feature extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    /**
     * Configuration features from ConfigStore
     */
    config: PropTypes.arrayOf(PropTypes.string),

    /**
     * List of required feature tags
     */
    feature: PropTypes.arrayOf(PropTypes.string),
    /**
     * List of required access levels
     */
    access: PropTypes.arrayOf(PropTypes.string),
    /**
     * If children is a function then will be treated as a render prop and passed this object:
     * {
     *   hasFeature: bool,
     *   hasAccess: bool,
     * }
     *
     * The other interface is more simple, only show `children` if org/project has
     * all the required feature AND access tags
     */
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  };

  getAllFeatures = () => {
    let {organization, project, config} = this.props;
    return {
      config: config || [],
      organization: (organization && organization.features) || [],
      project: (project && project.features) || [],
    };
  };

  hasFeature = (feature, features) => {
    let shouldMatchOnlyProject = /^project:/.test(feature);
    let shouldMatchOnlyOrg = /^organization:/.test(feature);

    // Array of feature strings
    let {config, organization, project} = features;

    if (shouldMatchOnlyProject) {
      return project.includes(feature);
    }

    if (shouldMatchOnlyOrg) {
      return organization.includes(feature);
    }

    // default, check all feature arrays
    return (
      config.includes(feature) ||
      organization.includes(feature) ||
      project.includes(feature)
    );
  };

  render() {
    let {children, organization, feature, access} = this.props;
    let {access: orgAccess} = organization || {access: []};
    let allFeatures = this.getAllFeatures();
    let hasFeature =
      !feature || feature.every(feat => this.hasFeature(feat, allFeatures));
    let hasAccess = !access || access.every(acc => orgAccess.includes(acc));

    if (typeof children === 'function') {
      return children({
        hasFeature,
        hasAccess,
      });
    }

    // if children is NOT a function,
    // then only render `children` iff `features` and `access` passes
    if (hasFeature && hasAccess) {
      return children;
    }

    return null;
  }
}

const FeatureContainer = createReactClass({
  displayName: 'FeatureContainer',
  contextTypes: {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  },
  mixins: [Reflux.listenTo(ConfigStore, 'onConfigStoreUpdate')],

  getInitialState() {
    return {
      config: ConfigStore.getConfig() || {},
    };
  },

  onConfigStoreUpdate(config) {
    if (config === this.state.config) return;
    this.setState({config});
  },

  render() {
    // TODO(billy): We can derive org/project from latestContextStore if needed, but
    // let's keep it simple for now and use org/project from context
    let features = this.state.config.features
      ? Array.from(this.state.config.features)
      : [];
    return (
      <Feature
        config={features}
        organization={this.context.organization}
        project={this.context.project}
        {...this.props}
      />
    );
  },
});

export default FeatureContainer;

import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {descopeFeatureName} from 'app/utils';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import SentryTypes from 'app/sentryTypes';

import ComingSoon from './comingSoon';

/**
 * Component to handle feature flags.
 */
class Feature extends React.Component {
  static propTypes = {
    /**
     * The following properties will be set by the FeatureContainer component
     * that typically wraps this component.
     */
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    configFeatures: PropTypes.arrayOf(PropTypes.string),

    /**
     * List of required feature tags. Note we do not enforce uniqueness of tags anywhere.
     * On the backend end, feature tags have a scope prefix string that is stripped out on the
     * frontend (since feature tags are attached to a context object).
     *
     * Use `organization:` or `project:` prefix strings to specify a feature with context.
     */
    features: PropTypes.arrayOf(PropTypes.string).isRequired,

    /**
     * Should the component require all features or just one or more.
     */
    requireAll: PropTypes.bool,

    /**
     * Custom renderer function for when the feature is not enabled.
     *
     *  - [default] Set this to false to disable rendering anything. If the
     *    feature is not enabled no children will be rendererd.
     *
     *  - Set this to `true` to use the default `ComingSoon` alert component.
     *
     *  - Provide a custom render function to customize the rendered component.
     *
     * When a custom render function is used, the same object that would be
     * passed to `children` if a func is provided there, will be used here.
     *
     * NOTE: HookStore capability.
     *
     * Enabling the renderDisabled prop (by setting `true` or passing a
     * function) will enable functionality to check the HookStore for a hook to
     * retrieve the no feature render function.
     *
     * The hookstore key that will be checked is:
     *
     *     feature-disabled:{unscoped-feature-name}
     *
     * This functionality will ONLY BE ACTIVATED when exactly ONE feature is
     * provided through the feature property.
     */
    renderDisabled: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),

    /**
     * If children is a function then will be treated as a render prop and
     * passed this object:
     *
     *   {
     *     organization,
     *     project,
     *     features: [],
     *     hasFeature: bool,
     *     renderDisabled: function,
     *   }
     *
     * Remember that the renderDisabled function may have been set by the
     * hookstore.
     *
     * The other interface is more simple, only show `children` if org/project has
     * all the required feature.
     */
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  };

  static defaultProps = {
    renderDisabled: false,
    requireAll: true,
  };

  getAllFeatures() {
    let {organization, project, configFeatures} = this.props;
    return {
      configFeatures: configFeatures || [],
      organization: (organization && organization.features) || [],
      project: (project && project.features) || [],
    };
  }

  hasFeature(feature, features) {
    let shouldMatchOnlyProject = feature.match(/^project:(\w+)/);
    let shouldMatchOnlyOrg = feature.match(/^organization:(\w+)/);

    // Array of feature strings
    let {configFeatures, organization, project} = features;

    if (shouldMatchOnlyProject) {
      return project.includes(shouldMatchOnlyProject[1]);
    }

    if (shouldMatchOnlyOrg) {
      return organization.includes(shouldMatchOnlyOrg[1]);
    }

    // default, check all feature arrays
    return (
      configFeatures.includes(feature) ||
      organization.includes(feature) ||
      project.includes(feature)
    );
  }

  render() {
    let {
      children,
      features,
      renderDisabled,
      organization,
      project,
      requireAll,
    } = this.props;

    let allFeatures = this.getAllFeatures();
    let method = requireAll ? 'every' : 'some';
    let hasFeature =
      !features || features[method](feat => this.hasFeature(feat, allFeatures));

    // Default renderDisabled to the ComingSoon component
    let customDisabledRender =
      renderDisabled === false
        ? false
        : typeof renderDisabled === 'function' ? renderDisabled : () => <ComingSoon />;

    // Override the renderDisabled function with a hook store function if there
    // is one registered for the feature.
    if (renderDisabled !== false && features.length === 1) {
      HookStore.get(`feature-disabled:${descopeFeatureName(features[0])}`)
        .slice(0, 1)
        .map(hookFn => (customDisabledRender = hookFn));
    }

    let renderProps = {
      organization,
      project,
      features,
      hasFeature,
      renderDisabled: customDisabledRender,
    };

    if (typeof children === 'function') {
      return children(renderProps);
    }

    return hasFeature
      ? children
      : renderDisabled !== false ? customDisabledRender(renderProps) : null;
  }
}

const FeatureContainer = createReactClass({
  displayName: 'FeatureContainer',

  // TODO(billy): We can derive org/project from latestContextStore if needed,
  // but let's keep it simple for now and use org/project from context
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
    let features = this.state.config.features
      ? Array.from(this.state.config.features)
      : [];

    return (
      <Feature
        configFeatures={features}
        organization={this.context.organization}
        project={this.context.project}
        {...this.props}
      />
    );
  },
});

export default FeatureContainer;

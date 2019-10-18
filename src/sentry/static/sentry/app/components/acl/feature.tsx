import PropTypes from 'prop-types';
import React from 'react';

import {Project, Organization, Config} from 'app/types';
import {FeatureDisabledHooks} from 'app/types/hooks';
import HookStore from 'app/stores/hookStore';
import SentryTypes from 'app/sentryTypes';
import withConfig from 'app/utils/withConfig';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

import ComingSoon from './comingSoon';

type FeatureProps = {
  organization: Organization;
  project: Project;
  config: Config;
  features: string[];
  requireAll?: boolean;
  renderDisabled?: Function | boolean;
  hookName?: keyof FeatureDisabledHooks;
  children: React.ReactNode;
};

/**
 * Component to handle feature flags.
 */
class Feature extends React.Component<FeatureProps> {
  static propTypes = {
    /**
     * The following properties will be set by the HoCs
     */
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    config: SentryTypes.Config.isRequired,

    /**
     * List of required feature tags. Note we do not enforce uniqueness of tags anywhere.
     * On the backend end, feature tags have a scope prefix string that is stripped out on the
     * frontend (since feature tags are attached to a context object).
     *
     * Use `organizations:` or `projects:` prefix strings to specify a feature with context.
     */
    features: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,

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
     * passed to `children` if a func is provided there, will be used here,
     * aditionally `children` will also be passed.
     */
    renderDisabled: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),

    /**
     * Specify the key to use for hookstore functionality.
     *
     * The hookName should be prefixed with `feature-disabled`.
     *
     * When specified, the hookstore will be checked if the feature is
     * disabled, and the first available hook will be used as the render
     * function.
     */
    hookName: PropTypes.string as any,

    /**
     * If children is a function then will be treated as a render prop and
     * passed this object:
     *
     *   {
     *     organization,
     *     project,
     *     features: [],
     *     hasFeature: bool,
     *   }
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

  getAllFeatures(): {
    configFeatures: string[];
    organization: string[];
    project: string[];
  } {
    const {organization, project, config} = this.props;

    return {
      configFeatures: config.features ? Array.from(config.features) : [],
      organization: (organization && organization.features) || [],
      project: (project && project.features) || [],
    };
  }

  hasFeature(feature, features) {
    const shouldMatchOnlyProject = feature.match(/^projects:(.+)/);
    const shouldMatchOnlyOrg = feature.match(/^organizations:(.+)/);

    // Array of feature strings
    const {configFeatures, organization, project} = features;

    // Check config store first as this overrides features scoped to org or
    // project contexts.
    if (configFeatures.includes(feature)) {
      return true;
    }

    if (shouldMatchOnlyProject) {
      return project.includes(shouldMatchOnlyProject[1]);
    }

    if (shouldMatchOnlyOrg) {
      return organization.includes(shouldMatchOnlyOrg[1]);
    }

    // default, check all feature arrays
    return organization.includes(feature) || project.includes(feature);
  }

  render() {
    const {
      children,
      features,
      renderDisabled,
      hookName,
      organization,
      project,
      requireAll,
    } = this.props;

    const allFeatures = this.getAllFeatures();
    const method = requireAll ? 'every' : 'some';
    const hasFeature =
      !features || features[method](feat => this.hasFeature(feat, allFeatures));

    // Default renderDisabled to the ComingSoon component
    let customDisabledRender =
      renderDisabled === false
        ? false
        : typeof renderDisabled === 'function'
        ? renderDisabled
        : () => <ComingSoon />;

    // Override the renderDisabled function with a hook store function if there
    // is one registered for the feature.
    if (hookName) {
      const hooks = HookStore.get(hookName);

      if (hooks.length > 0) {
        customDisabledRender = hooks[0];
      }
    }

    const renderProps = {
      organization,
      project,
      features,
      hasFeature,
    };

    if (!hasFeature && customDisabledRender !== false) {
      return customDisabledRender({children, ...renderProps});
    }

    if (typeof children === 'function') {
      return children(renderProps);
    }

    return hasFeature && children ? children : null;
  }
}

export default withOrganization(withProject(withConfig(Feature)));

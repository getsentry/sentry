import PropTypes from 'prop-types';
import React from 'react';

import {Project, Organization, Config} from 'app/types';
import {FeatureDisabledHooks} from 'app/types/hooks';
import HookStore from 'app/stores/hookStore';
import SentryTypes from 'app/sentryTypes';
import withConfig from 'app/utils/withConfig';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';
import {isRenderFunc} from 'app/utils/isRenderFunc';

import ComingSoon from './comingSoon';

type Props = {
  /**
   * The following properties will be set by the HoCs
   */

  organization: Organization;
  project: Project;
  config: Config;
  /**
   * List of required feature tags. Note we do not enforce uniqueness of tags anywhere.
   * On the backend end, feature tags have a scope prefix string that is stripped out on the
   * frontend (since feature tags are attached to a context object).
   *
   * Use `organizations:` or `projects:` prefix strings to specify a feature with context.
   */
  features: string[];
  /**
   * Should the component require all features or just one or more.
   */
  requireAll?: boolean;
  /**
   * Custom renderer function for when the feature is not enabled.
   *
   *  - [default] Set this to false to disable rendering anything. If the
   *    feature is not enabled no children will be rendered.
   *
   *  - Set this to `true` to use the default `ComingSoon` alert component.
   *
   *  - Provide a custom render function to customize the rendered component.
   *
   * When a custom render function is used, the same object that would be
   * passed to `children` if a func is provided there, will be used here,
   * additionally `children` will also be passed.
   */
  renderDisabled?:
    | ((props: FeatureRenderProps & Pick<Props, 'children'>) => React.ReactNode)
    | boolean;
  /**
   * Specify the key to use for hookstore functionality.
   *
   * The hookName should be prefixed with `feature-disabled`.
   *
   * When specified, the hookstore will be checked if the feature is
   * disabled, and the first available hook will be used as the render
   * function.
   */
  hookName?: keyof FeatureDisabledHooks;
  /**
   * If children is a function then will be treated as a render prop and
   * passed FeatureRenderProps.
   *
   * The other interface is more simple, only show `children` if org/project has
   * all the required feature.
   */
  children: React.ReactNode | ChildrenRenderFn;
};

type ChildrenRenderFn = (
  props: FeatureRenderProps & Pick<Props, 'renderDisabled'>
) => React.ReactNode;

type FeatureRenderProps = {
  organization: Organization;
  project: Project;
  features: string[];
  hasFeature: boolean;
};

type AllFeatures = {
  configFeatures: string[];
  organization: string[];
  project: string[];
};

/**
 * Component to handle feature flags.
 */
class Feature extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    config: SentryTypes.Config.isRequired,
    features: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    requireAll: PropTypes.bool,
    renderDisabled: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    hookName: PropTypes.string as any,
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  };

  static defaultProps = {
    renderDisabled: false,
    requireAll: true,
  };

  getAllFeatures(): AllFeatures {
    const {organization, project, config} = this.props;

    return {
      configFeatures: config.features ? Array.from(config.features) : [],
      organization: (organization && organization.features) || [],
      project: (project && project.features) || [],
    };
  }

  hasFeature(feature: string, features: AllFeatures) {
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

    if (isRenderFunc<ChildrenRenderFn>(children)) {
      return children({renderDisabled, ...renderProps});
    }

    return hasFeature && children ? children : null;
  }
}

export default withOrganization(withProject(withConfig(Feature)));

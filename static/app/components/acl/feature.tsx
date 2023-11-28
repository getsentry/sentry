import {Component} from 'react';

import HookStore from 'sentry/stores/hookStore';
import {Config, Organization, Project} from 'sentry/types';
import {FeatureDisabledHooks} from 'sentry/types/hooks';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import withConfig from 'sentry/utils/withConfig';
import withOrganization from 'sentry/utils/withOrganization';
import withProject from 'sentry/utils/withProject';

import ComingSoon from './comingSoon';

const renderComingSoon = () => <ComingSoon />;

type Props = {
  /**
   * If children is a function then will be treated as a render prop and
   * passed FeatureRenderProps.
   *
   * The other interface is more simple, only show `children` if org/project has
   * all the required feature.
   */
  children: React.ReactNode | ChildrenRenderFn;
  config: Config;
  /**
   * List of required feature tags. Note we do not enforce uniqueness of tags anywhere.
   * On the backend end, feature tags have a scope prefix string that is stripped out on the
   * frontend (since feature tags are attached to a context object).
   *
   * Use `organizations:` or `projects:` prefix strings to specify a feature with context.
   */
  features: string | string[];
  /**
   * The following properties will be set by the HoCs
   */
  organization: Organization;
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
  project?: Project;
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
  renderDisabled?: boolean | RenderDisabledFn;
  /**
   * Should the component require all features or just one or more.
   */
  requireAll?: boolean;
};

/**
 * Common props passed to children and disabled render handlers.
 */
type FeatureRenderProps = {
  features: string[];
  hasFeature: boolean;
  organization: Organization;
  project?: Project;
};

/**
 * When a feature is disabled the caller of Feature may provide a `renderDisabled`
 * prop. This prop can be overridden by getsentry via hooks. Often getsentry will
 * call the original children function  but override the `renderDisabled`
 * with another function/component.
 */
interface RenderDisabledProps extends FeatureRenderProps {
  children: React.ReactNode | ChildrenRenderFn;
  renderDisabled?: (props: FeatureRenderProps) => React.ReactNode;
}

export type RenderDisabledFn = (props: RenderDisabledProps) => React.ReactNode;

interface ChildRenderProps extends FeatureRenderProps {
  renderDisabled?: undefined | boolean | RenderDisabledFn;
}

export type ChildrenRenderFn = (props: ChildRenderProps) => React.ReactNode;

type AllFeatures = {
  configFeatures: ReadonlyArray<string>;
  organization: ReadonlyArray<string>;
  project: ReadonlyArray<string>;
};

/**
 * Component to handle feature flags.
 */
class Feature extends Component<Props> {
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
    // Array of feature strings
    const {configFeatures, organization, project} = features;

    // Check config store first as this overrides features scoped to org or
    // project contexts.
    if (configFeatures.includes(feature)) {
      return true;
    }

    const shouldMatchOnlyProject = feature.match(/^projects:(.+)/);
    if (shouldMatchOnlyProject) {
      return project.includes(shouldMatchOnlyProject[1]);
    }

    const shouldMatchOnlyOrg = feature.match(/^organizations:(.+)/);
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
      !features ||
      (typeof features === 'string'
        ? this.hasFeature(features, allFeatures)
        : features[method](feat => this.hasFeature(feat, allFeatures)));

    // Default renderDisabled to the ComingSoon component
    let customDisabledRender =
      renderDisabled === false
        ? false
        : typeof renderDisabled === 'function'
        ? renderDisabled
        : renderComingSoon;

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
      features: Array.isArray(features) ? features : [features],
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

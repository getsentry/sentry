import React, {useMemo} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Config, Organization, Project} from 'sentry/types';
import {FeatureDisabledHooks} from 'sentry/types/hooks';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import useOrganization from 'sentry/utils/useOrganization';
import withProject from 'sentry/utils/withProject';

import ComingSoon from './comingSoon';

const renderComingSoon = () => <ComingSoon />;

function isAllOf(p: FeatureProps): p is AnyOfFeaturesProps {
  return 'allOf' in p;
}

function isOneOf(p: FeatureProps): p is OneOfFeaturesProps {
  return 'oneOf' in p;
}

interface BaseProps {
  /**
   * If children is a function then will be treated as a render prop and
   * passed FeatureRenderProps.
   *
   * The other interface is more simple, only show `children` if org/project has
   * all the required feature.
   */
  children: React.ReactNode | ChildrenRenderFn;
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
  organization?: Organization;
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
}

interface SingleFeatureProps extends BaseProps {
  feature: string;
}

interface OneOfFeaturesProps extends BaseProps {
  oneOf: ReadonlyArray<string>;
}

interface AnyOfFeaturesProps extends BaseProps {
  allOf: ReadonlyArray<string>;
}

type FeatureProps = SingleFeatureProps | OneOfFeaturesProps | AnyOfFeaturesProps;

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

function extractFeaturesFromEntities(
  organization: Organization,
  project: Project | undefined,
  config: Config
) {
  return {
    configFeatures: config.features ? Array.from(config.features) : [],
    organization: (organization && organization.features) || [],
    project: (project && project.features) || [],
  };
}

function extractFeatures(props: FeatureProps): string | ReadonlyArray<string> {
  let validPropCount = 0;
  // ts wants us to properly check for discriminated union,
  // before we can access the property, but we're really only accessing it
  // and validating that we never receive multiple arguments
  // @ts-expect-error
  for (const candidate of [props.feature, props.oneOf, props.allOf]) {
    if (typeof candidate === 'undefined') {
      continue;
    }
    validPropCount++;
  }

  if (validPropCount > 1) {
    throw new Error('Only one of feature, oneOf, or anyOf can be specified.');
  }

  // @ts-expect-error same as above
  return props.feature ?? props.oneOf ?? props.allOf;
}

function hasSingleFeature(feature: string, features: AllFeatures) {
  // Array of feature strings
  const {configFeatures, organization, project} = features;

  // Check config store first as this overrides features scoped to org or
  // project contexts.
  if (configFeatures.includes(feature)) {
    return true;
  }

  const shouldMatchOnlyOrg = feature.match(/^organizations:(.+)/);
  if (shouldMatchOnlyOrg) {
    return organization.includes(shouldMatchOnlyOrg[1]);
  }

  const shouldMatchOnlyProject = feature.match(/^projects:(.+)/);
  if (shouldMatchOnlyProject) {
    return project.includes(shouldMatchOnlyProject[1]);
  }

  // default, check all feature arrays
  return organization.includes(feature) || project.includes(feature);
}

function hasFeatureAccess(
  props: FeatureProps,
  features: string | ReadonlyArray<string>,
  allFeatures: AllFeatures
) {
  if (Array.isArray(features)) {
    if (!features.length) {
      return true;
    }
    if (isAllOf(props)) {
      return features.every(feature => hasSingleFeature(feature, allFeatures));
    }
    if (isOneOf(props)) {
      return features.some(feature => hasSingleFeature(feature, allFeatures));
    }
    throw new Error('Only one of feature, oneOf, or anyOf can be specified.');
  }

  if (typeof features === 'string') {
    return hasSingleFeature(features, allFeatures);
  }

  throw new TypeError(
    `Invalid feature props, neither feature nor allOf or oneOf is defined, got ${JSON.stringify(
      features
    )}`
  );
}

/**
 * Component to handle feature flags.
 */

function Feature(props: FeatureProps) {
  const config = useLegacyStore(ConfigStore);
  const contextOrganization = useOrganization();

  const organization = props.organization ?? contextOrganization;
  const features = extractFeatures(props);
  const allFeaturesByEntity = extractFeaturesFromEntities(
    organization,
    props.project,
    config
  );

  const renderDisabled = props.renderDisabled ?? false;

  const hasFeature = useMemo(() => {
    return hasFeatureAccess(props, features, allFeaturesByEntity);
  }, [props, allFeaturesByEntity, features]);

  // Default renderDisabled to the ComingSoon component
  let customDisabledRender =
    renderDisabled === false
      ? false
      : typeof renderDisabled === 'function'
      ? renderDisabled
      : renderComingSoon;

  // Override the renderDisabled function with a hook store function if there
  // is one registered for the feature.
  if (props.hookName) {
    const hooks = HookStore.get(props.hookName);

    if (hooks.length > 0) {
      customDisabledRender = hooks[0];
    }
  }

  const renderProps = useMemo((): FeatureRenderProps => {
    return {
      organization,
      project: props.project,
      features: Array.isArray(features) ? features : [features],
      hasFeature,
    };
  }, [organization, props.project, features, hasFeature]);

  if (!hasFeature && customDisabledRender !== false) {
    return customDisabledRender({children: props.children, ...renderProps});
  }

  if (isRenderFunc<ChildrenRenderFn>(props.children)) {
    return props.children({renderDisabled: props.renderDisabled, ...renderProps});
  }

  return hasFeature && props.children ? props.children : null;
}

// HOC types + discriminated union doesnt play nice, so we'll cast to our type
export default withProject(
  Feature as unknown as React.ComponentType<FeatureProps>
) as unknown as React.ComponentType<FeatureProps>;

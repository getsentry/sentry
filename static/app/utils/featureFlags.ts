import {logger} from '@sentry/core';
import * as Sentry from '@sentry/react';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

/**
 * Returns a callback that can be used to track sentry flag evaluations through
 * the Sentry SDK, in the event context. If the FeatureFlagsIntegration is not
 * installed, the callback is a no-op.
 */
export function getSentryFeaturesHook(): (name: string, value: unknown) => void {
  const featureFlagsIntegration =
    Sentry.getClient()?.getIntegrationByName<Sentry.FeatureFlagsIntegration>(
      'FeatureFlags'
    );
  if (!featureFlagsIntegration || !('addFeatureFlag' in featureFlagsIntegration)) {
    logger.error(
      'Unable to track flag evaluations because FeatureFlagsIntegration is not installed correctly.'
    );
    return (_name, _value) => {};
  }
  return (name: string, value: unknown) => {
    // Append `feature.organizations:` in front to match the Sentry options automator format
    featureFlagsIntegration?.addFeatureFlag('feature.organizations:' + name, value);
  };
}

/**
 * Registers a hook that processes feature names and values on each call to
 * organization.features.includes().
 */
export function addOrganizationFeaturesHook({
  organization,
  hook,
}: {
  hook: (name: string, value: unknown) => void;
  organization: Organization;
}) {
  const handler = {
    apply: (includes: any, orgFeatures: string[], flagName: string[]) => {
      // Evaluate the result of .includes() and pass it to hook before returning
      const flagResult = includes.apply(orgFeatures, flagName);
      hook(flagName[0], flagResult);
      return flagResult;
    },
  };
  const proxy = new Proxy(organization.features.includes, handler);
  organization.features.includes = proxy;
}

/**
 * Registers a hook that processes feature names and values on each call to
 * organization.features.includes().
 */
export function addProjectFeaturesHook({
  project,
  hook,
}: {
  hook: (name: string, value: unknown) => void;
  project: Project;
}) {
  const handler = {
    apply: (includes: any, projFeatures: string[], flagName: string[]) => {
      // Evaluate the result of .includes() and pass it to hook before returning
      const flagResult = includes.apply(projFeatures, flagName);
      hook(flagName[0], flagResult);
      return flagResult;
    },
  };
  const proxy = new Proxy(project.features.includes, handler);
  project.features.includes = proxy;
}

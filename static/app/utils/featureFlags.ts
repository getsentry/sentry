import {logger} from '@sentry/core';
import * as Sentry from '@sentry/react';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

/**
 * Returns a callback that can be used to track sentry flag evaluations through
 * the Sentry SDK, in the event context. If the FeatureFlagsIntegration is not
 * installed, the callback is a no-op.
 *
 * @param prefix - optionally specifies a prefix for flag names, before calling
 *  the SDK hook
 */
export function buildSentryFeaturesHandler(
  prefix?: string
): (name: string, value: unknown) => void {
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
    featureFlagsIntegration?.addFeatureFlag((prefix ?? '') + name, value);
  };
}

/**
 * Registers a handler that processes feature names and values on each call to
 * organization.features.includes().
 */
export function addOrganizationFeaturesHandler({
  organization,
  handler,
}: {
  handler: (name: string, value: unknown) => void;
  organization: Organization;
}) {
  const includesHandler = {
    apply: (includes: any, orgFeatures: string[], flagName: string[]) => {
      // Evaluate the result of .includes() and pass it to hook before returning
      const flagResult = includes.apply(orgFeatures, flagName);
      handler(flagName[0], flagResult);
      return flagResult;
    },
  };
  const proxy = new Proxy(organization.features.includes, includesHandler);
  organization.features.includes = proxy;
}

/**
 * Registers a handler that processes feature names and values on each call to
 * organization.features.includes().
 */
export function addProjectFeaturesHandler({
  project,
  handler,
}: {
  handler: (name: string, value: unknown) => void;
  project: Project;
}) {
  const includesHandler = {
    apply: (includes: any, projFeatures: string[], flagName: string[]) => {
      // Evaluate the result of .includes() and pass it to hook before returning
      const flagResult = includes.apply(projFeatures, flagName);
      handler(flagName[0], flagResult);
      return flagResult;
    },
  };
  const proxy = new Proxy(project.features.includes, includesHandler);
  project.features.includes = proxy;
}

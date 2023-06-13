import ConfigStore from 'sentry/stores/configStore';
import {Organization} from 'sentry/types';

export function prioritySortExperimentEnabled(organization: Organization) {
  /**
   * Return true if the experiment is enabled for this organization and that we should log the experiment
   */
  return (
    organization.isEarlyAdopter &&
    organization.features.includes('better-priority-sort-experiment') &&
    !organization.features.includes('issue-list-better-priority-sort') // exclude orgs explicitly on
  );
}

export function getPrioritySortVariant(organization: Organization) {
  /**
   * Return the priority variant for this organization.
   * If the experiment is not enabled, return undefined
   */
  const user = ConfigStore.get('user');
  const _variant = user.experiments?.PrioritySortExperiment || 'baseline';

  // check if the experiment is active
  const isInExperiment = prioritySortExperimentEnabled(organization);

  // feature flag override to force variant1
  // otherwise let the experiment decide
  return organization.features.includes('issue-list-better-priority-sort')
    ? 'variant1'
    : isInExperiment
    ? _variant
    : undefined;
}

export function enablePrioritySortByDefault(organization: Organization) {
  /**
   * Returns true if the new priority sort should be enabled by default
   */
  return getPrioritySortVariant(organization) !== undefined;
}

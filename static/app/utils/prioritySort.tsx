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
   * Return the priority variant for this organization
   * basline is the default behavior
   */
  const user = ConfigStore.get('user');
  const _variant = user.experiments?.PrioritySortExperiment || 'baseline';

  // check if the experiment is active
  const isInExperiment = prioritySortExperimentEnabled(organization);

  // feature flag override to force variant1
  // otherwise let the experiment decide
  const isVariant1 =
    organization.features.includes('issue-list-better-priority-sort') ||
    (isInExperiment && _variant === 'variant1');
  const isVariant2 = isInExperiment && _variant === 'variant2';

  return isVariant1 ? 'variant1' : isVariant2 ? 'variant2' : 'baseline';
}

export function enablePrioritySortByDefault(organization: Organization) {
  /**
   * Returns true if the new priority sort should be enabled by default
   */
  return getPrioritySortVariant(organization) !== 'baseline';
}

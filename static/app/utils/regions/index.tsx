import type {SelectValue} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {Cell, Locality} from 'sentry/types/system';

const LocalityDisplayName: Record<string, string> = {
  US: t('United States of America (US)'),
  US2: t('United States of America (US2)'),
  DE: t('European Union (EU)'),
};

const LocalityFlagIndicator: Record<string, string> = {
  US: '🇺🇸',
  US2: '🇺🇸',
  DE: '🇪🇺',
};

interface LocalityData {
  displayName: string;
  label: string;
  name: string;
  url: string;
  flag?: string;
}

function getLocalityDisplayName(locality: Locality): string {
  return LocalityDisplayName[locality.name.toUpperCase()] ?? locality.name;
}

function getLocalityFlagIndicator(locality: Locality): string {
  const localityName = locality.name.toUpperCase();
  return LocalityFlagIndicator[localityName] ?? '';
}

export function getLocalityDataFromOrganization(
  organization: Organization
): LocalityData | undefined {
  const {regionUrl} = organization.links;

  const localities = getLocalities();
  const locality = localities.find(value => {
    return value.url === regionUrl;
  });

  if (!locality) {
    return undefined;
  }
  const flag = getLocalityFlagIndicator(locality);
  const displayName = getLocalityDisplayName(locality);

  return {
    flag,
    displayName,
    label: `${flag} ${displayName}`,
    name: locality.name,
    url: locality.url,
  };
}

/**
 * Get the customer facing list of localities that are available
 */
export function getLocalities(): Locality[] {
  return ConfigStore.get('localities') ?? [];
}

/**
 * Get the list of all cells available with a staff session.
 */
export function getCells(): Cell[] {
  return ConfigStore.get('cells') ?? [];
}

/**
 * Get a list of option objects {label: displayName, value: url}
 */
export function getLocalityUrlOptions(
  exclude: LocalityData[] = [],
  only: string[] = []
): Array<SelectValue<string>> {
  const localities = getLocalities();
  const excludedRegionNames = exclude.map(region => region.name);

  return localities
    .filter(locality => {
      if (
        excludedRegionNames.includes(locality.name) ||
        (only.length > 0 && !only.includes(locality.name)) ||
        CUSTOMER_HIDDEN_REGIONS.has(locality.name)
      ) {
        return false;
      }
      return true;
    })
    .map(locality => {
      const {url} = locality;
      return {
        value: url,
        label: `${getLocalityFlagIndicator(locality)} ${getLocalityDisplayName(locality)}`,
      };
    });
}

// TODO(cells) Rework/remove this once Region -> Locality config changes are completed.
const CUSTOMER_HIDDEN_REGIONS = new Set(['us2']);

/**
 * Create a list of option objects with {label: displayName, value: name}
 */
export function getLocalityNameOptions(): Array<SelectValue<string>> {
  const localities = getLocalities();

  return localities
    .filter(locality => !CUSTOMER_HIDDEN_REGIONS.has(locality.name))
    .map(locality => {
      return {
        value: locality.name,
        label: `${getLocalityFlagIndicator(locality)} ${getLocalityDisplayName(locality)}`,
      };
    });
}

export function shouldDisplayLocalities(): boolean {
  return getLocalities().length > 1;
}

import type {SelectValue} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {Region} from 'sentry/types/system';

const RegionDisplayName: Record<string, string> = {
  US: t('United States of America (US)'),
  US2: t('United States of America (US2)'),
  DE: t('European Union (EU)'),
};

const RegionFlagIndicator: Record<string, string> = {
  US: '🇺🇸',
  US2: '🇺🇸',
  DE: '🇪🇺',
};

interface RegionData {
  displayName: string;
  label: string;
  name: string;
  url: string;
  flag?: string;
}

function getRegionDisplayName(region: Region): string {
  return RegionDisplayName[region.name.toUpperCase()] ?? region.name;
}

function getRegionFlagIndicator(region: Region): string {
  const regionName = region.name.toUpperCase();
  return RegionFlagIndicator[regionName] ?? '';
}

export function getRegionDataFromOrganization(
  organization: Organization
): RegionData | undefined {
  const {regionUrl} = organization.links;

  const regions = getRegions();
  const region = regions.find(value => {
    return value.url === regionUrl;
  });

  if (!region) {
    return undefined;
  }
  const flag = getRegionFlagIndicator(region);
  const displayName = getRegionDisplayName(region);

  return {
    flag,
    displayName,
    label: `${flag} ${displayName}`,
    name: region.name,
    url: region.url,
  };
}

export function getRegions(): Region[] {
  return ConfigStore.get('regions') ?? [];
}

/**
 * Get a list of option objects {label: displayName, value: url}
 */
export function getRegionUrlOptions(
  exclude: RegionData[] = [],
  only: string[] = []
): Array<SelectValue<string>> {
  const regions = getRegions();
  const excludedRegionNames = exclude.map(region => region.name);

  return regions
    .filter(region => {
      if (
        excludedRegionNames.includes(region.name) ||
        (only.length > 0 && !only.includes(region.name)) ||
        CUSTOMER_HIDDEN_REGIONS.has(region.name)
      ) {
        return false;
      }
      return true;
    })
    .map(region => {
      const {url} = region;
      return {
        value: url,
        label: `${getRegionFlagIndicator(region)} ${getRegionDisplayName(region)}`,
      };
    });
}

// TODO(cells) Rework/remove this once Region -> Locality config changes are completed.
const CUSTOMER_HIDDEN_REGIONS = new Set(['us2']);

/**
 * Create a list of option objects with {label: displayName, value: name}
 */
export function getRegionNameOptions(): Array<SelectValue<string>> {
  const regions = getRegions();

  return regions
    .filter(region => !CUSTOMER_HIDDEN_REGIONS.has(region.name))
    .map(region => {
      return {
        value: region.name,
        label: `${getRegionFlagIndicator(region)} ${getRegionDisplayName(region)}`,
      };
    });
}

export function shouldDisplayRegions(): boolean {
  return getRegions().length > 1;
}

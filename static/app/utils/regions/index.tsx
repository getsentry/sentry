import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization, Region} from 'sentry/types';

const RegionDisplayName: Record<string, string> = {
  US: t('United States of America (US)'),
  DE: t('European Union (EU)'),
};

enum RegionFlagIndicator {
  US = '🇺🇸',
  DE = '🇪🇺',
}

export interface RegionData {
  displayName: string;
  name: string;
  url: string;
  flag?: RegionFlagIndicator;
}

export function getRegionDisplayName(region: Region): string {
  return RegionDisplayName[region.name.toUpperCase()] ?? region.name;
}

export function getRegionFlagIndicator(region: Region): RegionFlagIndicator | undefined {
  const regionName = region.name.toUpperCase();
  return RegionFlagIndicator[regionName];
}

export function getRegionDataFromOrganization(
  organization: Organization
): RegionData | undefined {
  const {regionUrl} = organization.links;

  const regions = ConfigStore.get('regions') ?? [];

  const region = regions.find(value => {
    return value.url === regionUrl;
  });

  if (!region) {
    return undefined;
  }

  return {
    flag: getRegionFlagIndicator(region),
    displayName: getRegionDisplayName(region),
    name: region.name,
    url: region.url,
  };
}

export function getRegionChoices(): [string, string][] {
  const regions = ConfigStore.get('regions') ?? [];

  return regions.map(region => {
    const {url} = region;
    return [
      url,
      `${getRegionFlagIndicator(region) || ''} ${getRegionDisplayName(region)}`,
    ];
  });
}

export function shouldDisplayRegions(): boolean {
  const regionCount = (ConfigStore.get('regions') ?? []).length;
  return (
    ConfigStore.get('features').has('organizations:multi-region-selector') &&
    regionCount > 1
  );
}

import ConfigStore from 'sentry/stores/configStore';
import {Organization, Region} from 'sentry/types';

export enum RegionDisplayName {
  US = 'United States of America (US)',
  DE = 'European Union (EU)',
}

export enum RegionFlagIndicator {
  US = '🇺🇸',
  DE = '🇪🇺',
}

export interface RegionData {
  regionDisplayName: string;
  regionName: string;
  regionUrl: string;
  regionFlag?: RegionFlagIndicator;
}

export function getRegionDisplayName(region: Region): string {
  const regionName = region.name.toUpperCase();

  if (RegionDisplayName[regionName]) {
    return RegionDisplayName[regionName];
  }

  return region.name;
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
    regionFlag: getRegionFlagIndicator(region),
    regionDisplayName: getRegionDisplayName(region),
    regionName: region.name,
    regionUrl: region.url,
  };
}

export function getRegionChoices(): [string, string][] {
  const regions = ConfigStore.get('regions') ?? [];

  return regions.map(region => {
    const {name} = region;
    return [
      name,
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

export function getRegionByName(regionName: string): Region | undefined {
  return ConfigStore.get('regions').find(
    ({name}) => name.toUpperCase() === regionName.toUpperCase()
  );
}

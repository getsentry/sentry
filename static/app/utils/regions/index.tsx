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
  name: string;
  url: string;
  flag?: string;
}

function getRegionDisplayName(region: Region): string {
  return RegionDisplayName[region.name.toUpperCase()] ?? region.name;
}

function getRegionFlagIndicator(region: Region): string | undefined {
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

export function getRegions(): Region[] {
  return ConfigStore.get('regions') ?? [];
}

export function getRegionChoices(exclude: RegionData[] = []): Array<[string, string]> {
  const regions = getRegions();
  const excludedRegionNames = exclude.map(region => region.name);

  return regions
    .filter(region => {
      return !excludedRegionNames.includes(region.name);
    })
    .map(region => {
      const {url} = region;
      return [
        url,
        `${getRegionFlagIndicator(region) || ''} ${getRegionDisplayName(region)}`,
      ];
    });
}

export function getRegionNameChoices(): Array<[string, string]> {
  const regions = getRegions();

  return regions.map(region => {
    return [
      region.name,
      `${getRegionFlagIndicator(region) || ''} ${getRegionDisplayName(region)}`,
    ];
  });
}

export function shouldDisplayRegions(): boolean {
  return getRegions().length > 1;
}

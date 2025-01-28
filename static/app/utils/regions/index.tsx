import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {Region} from 'sentry/types/system';

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
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

export function shouldDisplayRegions(): boolean {
  return getRegions().length > 1;
}

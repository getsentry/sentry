import {TagWithTopValues} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';

import TagFacetsBars from './tagFacetsBars';
import TagFacetsBreakdowns from './tagFacetsBreakdowns';
import TagFacetsDistributions from './tagFacetsDistributions';
import {TagFacetsProps} from './tagFacetsTypes';

export const MOBILE_TAGS = ['device', 'os', 'release', 'environment', 'transaction'];

export const FRONTEND_TAGS = ['browser', 'transaction', 'release', 'url', 'environment'];

export const BACKEND_TAGS = [
  'transaction',
  'url',
  'user',
  'release',
  'organization.slug',
];

export const DEFAULT_TAGS = ['transaction', 'environment', 'release'];

export function TAGS_FORMATTER(tagsData: Record<string, TagWithTopValues>) {
  // For "release" tag keys, format the release tag value to be more readable (ie removing version prefix)
  const transformedTagsData = {};
  Object.keys(tagsData).forEach(tagKey => {
    if (tagKey === 'release') {
      transformedTagsData[tagKey] = {
        ...tagsData[tagKey],
        topValues: tagsData[tagKey].topValues.map(topValue => {
          return {
            ...topValue,
            name: formatVersion(topValue.name),
          };
        }),
      };
    } else if (tagKey === 'device') {
      transformedTagsData[tagKey] = {
        ...tagsData[tagKey],
        topValues: tagsData[tagKey].topValues.map(topValue => {
          return {
            ...topValue,
            name: topValue.readable ?? topValue.name,
          };
        }),
      };
    } else {
      transformedTagsData[tagKey] = tagsData[tagKey];
    }
  });
  return transformedTagsData;
}

export type TagFacetsStyles = 'bars' | 'breakdowns' | 'distributions';

export function TagFacets(props: TagFacetsProps & {style: TagFacetsStyles}) {
  return props.style === 'breakdowns' ? (
    <TagFacetsBreakdowns {...props} />
  ) : props.style === 'distributions' ? (
    <TagFacetsDistributions {...props} />
  ) : (
    <TagFacetsBars {...props} />
  );
}

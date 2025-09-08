import type {SpanResult} from 'sentry/views/explore/tables/tracesTable/types';

import type {Field} from './data';

export function getStylingSliceName(
  sliceName: string | null,
  sliceSecondaryName: string | null
) {
  if (sliceSecondaryName) {
    // Our color picking relies on the first 4 letters. Since we want to differentiate sdknames and project names we have to include part of the sdk name.
    return (sliceName ?? '').slice(0, 1) + sliceSecondaryName.slice(-4);
  }

  return sliceName;
}

export function getSecondaryNameFromSpan(span: SpanResult<Field>) {
  return span['sdk.name'];
}

export function getShortenedSdkName(sdkName: string | null) {
  if (!sdkName) {
    return '';
  }
  const sdkNameParts = sdkName.split('.');
  if (sdkNameParts.length <= 1) {
    return sdkName;
  }
  return sdkNameParts[sdkNameParts.length - 1];
}

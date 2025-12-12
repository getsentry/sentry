import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

import {getDetectorTypePath} from './utils/detectorTypeConfig';

export const makeMonitorBasePathname = (orgSlug: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/monitors/`);
};

export const makeMonitorTypePathname = (orgSlug: string, detectorType: DetectorType) => {
  const typePath = getDetectorTypePath(detectorType);
  if (!typePath) {
    return makeMonitorBasePathname(orgSlug);
  }
  return normalizeUrl(`${makeMonitorBasePathname(orgSlug)}${typePath}/`);
};

export const makeMonitorDetailsPathname = (orgSlug: string, monitorId: string) => {
  return normalizeUrl(`${makeMonitorBasePathname(orgSlug)}${monitorId}/`);
};

export const makeMonitorCreatePathname = (orgSlug: string) => {
  return normalizeUrl(`${makeMonitorBasePathname(orgSlug)}new/`);
};

export const makeMonitorCreateSettingsPathname = (orgSlug: string) => {
  return normalizeUrl(`${makeMonitorBasePathname(orgSlug)}new/settings/`);
};

export const makeMonitorEditPathname = (orgSlug: string, monitorId: string) => {
  return normalizeUrl(`${makeMonitorBasePathname(orgSlug)}${monitorId}/edit/`);
};

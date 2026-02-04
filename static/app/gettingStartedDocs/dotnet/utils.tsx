import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export const getInstallSnippetPackageManager = (params: DocsParams) => {
  let version = '6.0.0';
  if (params.isMetricsSelected) {
    version = '6.1.0';
  }

  return `
Install-Package Sentry -Version ${getPackageVersion(params, 'sentry.dotnet', version)}`;
};

export const getInstallSnippetCoreCli = (params: DocsParams) => {
  let version = '6.0.0';
  if (params.isMetricsSelected) {
    version = '6.1.0';
  }

  return `
dotnet add package Sentry -v ${getPackageVersion(params, 'sentry.dotnet', version)}`;
};

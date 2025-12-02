import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export const getInstallSnippetPackageManager = (params: DocsParams) => `
Install-Package Sentry -Version ${getPackageVersion(
  params,
  'sentry.dotnet',
  params.isProfilingSelected ? '4.3.0' : '3.34.0'
)}`;

export const getInstallSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry -v ${getPackageVersion(
  params,
  'sentry.dotnet',
  params.isProfilingSelected ? '4.3.0' : '3.34.0'
)}`;

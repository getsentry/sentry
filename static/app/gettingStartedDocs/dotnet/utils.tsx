import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export type DotNetSdkPackage = {
  /** The NuGet package name, such as `Sentry.AspNetCore`. */
  name: string;
  /** The package's key in the release registry, such as `sentry.dotnet.aspnetcore`. */
  registryKey: string;
};

const CORE_PACKAGE: DotNetSdkPackage = {name: 'Sentry', registryKey: 'sentry.dotnet'};

export const getInstallSnippetPackageManager = (
  params: DocsParams,
  {name, registryKey}: DotNetSdkPackage = CORE_PACKAGE
) => `
Install-Package ${name} -Version ${getPackageVersion(params, registryKey, '7.0.0')}`;

export const getInstallSnippetCoreCli = (
  params: DocsParams,
  {name, registryKey}: DotNetSdkPackage = CORE_PACKAGE
) => `
dotnet add package ${name} -v ${getPackageVersion(params, registryKey, '7.0.0')}`;

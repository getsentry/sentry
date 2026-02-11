import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

// Sentry SDK for .NET 6.1.0 adds initial experimental support for Metrics
export const getInstallSnippetPackageManager = (params: DocsParams) => `
Install-Package Sentry -Version ${getPackageVersion(params, 'sentry.dotnet', '6.1.0')}`;

// Sentry SDK for .NET 6.1.0 adds initial experimental support for Metrics
export const getInstallSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry -v ${getPackageVersion(params, 'sentry.dotnet', '6.1.0')}`;

import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippetPackageManager = (params: Params) => `
Install-Package Sentry.AspNet -Version ${getPackageVersion(
  params,
  'sentry.dotnet.aspnet',
  '3.34.0'
)}`;

const getInstallSnippetEntityFramework = (params: Params) => `
Install-Package Sentry.EntityFramework -Version ${getPackageVersion(
  params,
  'sentry.dotnet.aspnet',
  '3.34.0'
)}`;

const getInstallProfilingSnippet = () => `
Install-Package Sentry.Profiling`;

enum DotNetPlatform {
  WINDOWS_LINUX_MACOS,
  IOS_MACCATALYST,
}

const getConfigureSnippet = (params: Params, platform?: DotNetPlatform) => `
using System;
using System.Configuration;
using System.Web.Mvc;
using System.Web.Routing;
using Sentry;
using Sentry.AspNet;
using Sentry.EntityFramework; // if you installed Sentry.EntityFramework

public class MvcApplication : HttpApplication
{
    private IDisposable _sentry;

    protected void Application_Start()
    {
        // Initialize Sentry to capture AppDomain unhandled exceptions and more.
        _sentry = SentrySdk.Init(o =>
        {
            o.AddAspNet();
            o.Dsn = "${params.dsn}";
            // When configuring for the first time, to see what the SDK is doing:
            o.Debug = true;${
              params.isPerformanceSelected
                ? `
            // Set TracesSampleRate to 1.0 to capture 100%
            // of transactions for performance monitoring.
            // We recommend adjusting this value in production
            o.TracesSampleRate = 1.0;`
                : ''
            }${
              params.isProfilingSelected
                ? `
            // Sample rate for profiling, applied on top of othe TracesSampleRate,
            // e.g. 0.2 means we want to profile 20 % of the captured transactions.
            // We recommend adjusting this value in production.
            o.ProfilesSampleRate = 1.0;${
              platform !== DotNetPlatform.IOS_MACCATALYST
                ? `
            // Requires NuGet package: Sentry.Profiling
            // Note: By default, the profiler is initialized asynchronously. This can be tuned by passing a desired initialization timeout to the constructor.
            o.AddIntegration(new ProfilingIntegration(
                // During startup, wait up to 500ms to profile the app startup code. This could make launching the app a bit slower so comment it out if your prefer profiling to start asynchronously
                TimeSpan.FromMilliseconds(500)
            ));`
                : ''
            }`
                : ''
            }
            // If you are using EF (and installed the NuGet package):
            o.AddEntityFramework();
        });
    }

    // Global error catcher
    protected void Application_Error() => Server.CaptureLastError();

    protected void Application_BeginRequest()
    {
        Context.StartSentryTransaction();
    }

    protected void Application_EndRequest()
    {
        Context.FinishSentryTransaction();
    }

    protected void Application_End()
    {
        // Flushes out events before shutting down.
        _sentry?.Dispose();
    }
}
        `;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct('Install the [strong:NuGet] package:', {
        strong: <strong />,
      }),
      configurations: [
        {
          language: 'shell',
          partialLoading: params.sourcePackageRegistries.isLoading,
          description: t('Package Manager:'),
          code: getInstallSnippetPackageManager(params),
        },
        {
          language: 'shell',
          partialLoading: params.sourcePackageRegistries.isLoading,
          description: t('Using Entity Framework 6?'),
          code: getInstallSnippetEntityFramework(params),
        },
        ...(params.isProfilingSelected
          ? [
              {
                description: tct(
                  'Additionally, for all platforms except iOS/Mac Catalyst, you need to add a dependency on the [sentryProfilingPackage:Sentry.Profiling] NuGet package.',
                  {
                    sentryProfilingPackage: <code />,
                  }
                ),
                language: 'shell',
                code: getInstallProfilingSnippet(),
              },
              {
                description: t(
                  '.NET profiling alpha is available for Windows, Linux, macOS, iOS, Mac Catalyst on .NET 6.0+ (tested on .NET 7.0 & .NET 8.0).'
                ),
              },
            ]
          : []),
      ],
      additionalInfo: (
        <AlertWithoutMarginBottom type="info">
          {tct(
            '[strong:Using .NET Framework prior to 4.6.1?] Our legacy SDK supports .NET Framework as early as 3.5.',
            {strong: <strong />}
          )}
        </AlertWithoutMarginBottom>
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'You should [initCode:init] the Sentry SDK as soon as possible during your application load by adding Sentry to [globalCode:Global.asax.cs]:',
        {
          initCode: <code />,
          globalCode: <code />,
        }
      ),
      configurations: [
        params.isProfilingSelected
          ? {
              code: [
                {
                  language: 'csharp',
                  label: 'Windows/Linux/macOS',
                  value: 'Windows/Linux/macOS',
                  code: getConfigureSnippet(params, DotNetPlatform.WINDOWS_LINUX_MACOS),
                },
                {
                  language: 'csharp',
                  label: 'iOS/Mac Catalyst',
                  value: 'ios/macCatalyst',
                  code: getConfigureSnippet(params, DotNetPlatform.IOS_MACCATALYST),
                },
              ],
            }
          : {
              language: 'csharp',
              code: getConfigureSnippet(params),
            },
      ],
    },
  ],
  // TODO: Add proper verify step
  verify: () => [
    {
      title: t('Documentation'),
      description: tct(
        "Once you've verified the package is initialized properly and sent a test event, consider visiting our [link:complete ASP.NET docs].",
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnet/" />
          ),
        }
      ),
    },
    {
      title: t('Samples'),
      description: (
        <Fragment>
          {t(
            'See the following examples that demonstrate how to integrate Sentry with various frameworks.'
          )}
          <List symbol="bullet">
            <ListItem>
              {tct(
                '[link:Multiple samples in the [code:dotnet] SDK repository] [strong:(C#)]',
                {
                  link: (
                    <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples" />
                  ),
                  code: <code />,
                  strong: <strong />,
                }
              )}
            </ListItem>
            <ListItem>
              {tct('[link:Basic F# sample] [strong:(F#)]', {
                link: <ExternalLink href="https://github.com/sentry-demos/fsharp" />,
                strong: <strong />,
              })}
            </ListItem>
          </List>
        </Fragment>
      ),
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      configurations: [
        getCrashReportSDKInstallFirstStep(params),
        {
          description: tct(
            'If you are rendering the page from the server, for example on ASP.NET MVC, the [code:Error.cshtml] razor page can be:',
            {code: <code />}
          ),
          code: [
            {
              label: 'cshtml',
              value: 'html',
              language: 'html',
              code: `@if (SentrySdk.LastEventId != SentryId.Empty) {
  <script>
    Sentry.init({ dsn: "${params.dsn}" });
    Sentry.showReportDialog({ eventId: "@SentrySdk.LastEventId" });
  </script>
}`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/dotnet/guides/aspnet/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding,
};

export default docs;

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;

import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallSnippetPackageManager = (params: DocsParams) => `
Install-Package Sentry.AspNet -Version ${getPackageVersion(
  params,
  'sentry.dotnet.aspnet',
  '3.34.0'
)}`;

const getInstallSnippetEntityFramework = (params: DocsParams) => `
Install-Package Sentry.EntityFramework -Version ${getPackageVersion(
  params,
  'sentry.dotnet.aspnet',
  '3.34.0'
)}`;

const getConfigureSnippet = (params: DocsParams) => `
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
            o.Dsn = "${params.dsn.public}";
            // When configuring for the first time, to see what the SDK is doing:
            o.Debug = true;${
              params.isPerformanceSelected
                ? `
            // Set TracesSampleRate to 1.0 to capture 100%
            // of transactions for tracing.
            // We recommend adjusting this value in production
            o.TracesSampleRate = 1.0;`
                : ''
            }
            // If you are using EF (and installed the NuGet package):
            o.AddEntityFramework();
        });
    }

    // Global error catcher
    protected void Application_Error() => Server.CaptureLastError();

    ${
      params.isPerformanceSelected
        ? `
    protected void Application_BeginRequest()
    {
        Context.StartSentryTransaction();
    }

    protected void Application_EndRequest()
    {
        Context.FinishSentryTransaction();
    }`
        : ''
    }

    protected void Application_End()
    {
        // Flushes out events before shutting down.
        _sentry?.Dispose();
    }
}
        `;

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install the [strong:NuGet] package:', {
            strong: <strong />,
          }),
        },
        {
          type: 'text',
          text: t('Package Manager:'),
        },
        {
          type: 'code',
          language: 'shell',
          code: getInstallSnippetPackageManager(params),
        },
        {
          type: 'text',
          text: t('Using Entity Framework 6?'),
        },
        {
          type: 'code',
          language: 'shell',
          code: getInstallSnippetEntityFramework(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'You should [code:init] the Sentry SDK as soon as possible during your application load by adding Sentry to [code:Global.asax.cs]:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
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
      content: [
        {
          type: 'text',
          text: tct(
            "Once you've verified the package is initialized properly and sent a test event, consider visiting our [link:complete ASP.NET docs].",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnet/" />
              ),
            }
          ),
        },
      ],
    },
    {
      title: t('Samples'),
      content: [
        {
          type: 'text',
          text: t(
            'See the following examples that demonstrate how to integrate Sentry with various frameworks.'
          ),
        },
        {
          type: 'list',
          items: [
            tct(
              '[link:Multiple samples in the [code:dotnet] SDK repository] [strong:(C#)]',
              {
                link: (
                  <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples" />
                ),
                code: <code />,
                strong: <strong />,
              }
            ),
            tct('[link:Basic F# sample] [strong:(F#)]', {
              link: <ExternalLink href="https://github.com/sentry-demos/fsharp" />,
              strong: <strong />,
            }),
          ],
        },
      ],
    },
  ],
};

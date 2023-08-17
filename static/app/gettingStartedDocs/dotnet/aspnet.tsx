import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct('Install the [strong:NuGet] package:', {
          strong: <strong />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'shell',
        description: t('Package Manager:'),
        code: 'Install-Package Sentry.AspNet -Version 3.34.0',
      },
      {
        language: 'shell',
        description: t('Using Entity Framework 6?'),
        code: 'Install-Package Sentry.EntityFramework -Version 3.34.0',
      },
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
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'You should [initCode:init] the Sentry SDK as soon as possible during your application load by adding Sentry to [globalCode:Global.asax.cs]:',
          {
            initCode: <code />,
            globalCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'csharp',
        code: `
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
            o.Dsn = "${dsn}";
            // When configuring for the first time, to see what the SDK is doing:
            o.Debug = true;
            // Set TracesSampleRate to 1.0 to capture 100%
            // of transactions for performance monitoring.
            // We recommend adjusting this value in production
            o.TracesSampleRate = 1.0;
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
        `,
      },
    ],
  },
  {
    title: t('Documentation'),
    description: (
      <p>
        {tct(
          "Once you've verified the package is initialized properly and sent a test event, consider visiting our [link:complete ASP.NET docs].",
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnet/" />
            ),
          }
        )}
      </p>
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
];
// Configuration End

export function GettingStartedWithAspnet({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithAspnet;

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;

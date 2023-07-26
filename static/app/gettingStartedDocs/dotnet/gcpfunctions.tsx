import {Fragment} from 'react';

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
        code: 'Install-Package Sentry.Google.Cloud.Functions -Version 3.34.0',
      },
      {
        language: 'shell',
        description: t('Or .NET Core CLI:'),
        code: 'dotnet add package Sentry.Google.Cloud.Functions -v 3.34.0',
      },
      {
        language: 'xml',
        description: t('Or, manually add the Sentry dependency into your csproj file:'),
        code: `
<ItemGroup>
  <PackageReference Include="Sentry.Google.Cloud.Functions" Version="3.34.0"/>
</ItemGroup>
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'Then, add Sentry to the [functionCode:Function] class through [functionStartupCode:FunctionsStartup]:',
          {
            functionCode: <code />,
            functionStartupCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'csharp',
        code: `
// Add the following line:
[assembly: FunctionsStartup(typeof(SentryStartup))]

public class Function : IHttpFunction
{
    public Task HandleAsync(HttpContext context)
    {
        // Your function code here.
    }
}
        `,
      },
      {
        language: 'json',
        description: (
          <p>
            {tct(
              "Additionally, you'll need to set up your [sentryCode:Sentry] settings on [appsettingsCode:appsettings.json]:",
              {sentryCode: <code />, appsettingsCode: <code />}
            )}
          </p>
        ),
        code: `
{
  "Sentry": {
    "Dsn": "${dsn}",
    // Sends Cookies, User Id when one is logged on and user IP address to sentry. It's turned off by default.
    "SendDefaultPii": true,
    // When configuring for the first time, to see what the SDK is doing:
    "Debug": true,
    // Opt-in for payload submission.
    "MaxRequestBodySize": "Always",
    // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production.
    "TracesSampleRate": 1
  }
}
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t('To verify your setup, you can capture a message with the SDK:'),
    configurations: [
      {
        language: 'csharp',
        code: `
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Sentry;

public Task HandleAsync(HttpContext context)
{
    SentrySdk.CaptureMessage("Hello Sentry");
}
        `,
      },
    ],
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
            {tct('[link:Google Cloud Functions sample]', {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples/Sentry.Samples.Google.Cloud.Functions" />
              ),
            })}
          </ListItem>
          <ListItem>
            {tct(
              '[link:Multiple samples in the [code:dotnet] SDK repository] [strong:(C#)]',
              {
                link: (
                  <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples" />
                ),
                strong: <strong />,
                code: <code />,
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

export function GettingStartedWithGCPFunctions({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithGCPFunctions;

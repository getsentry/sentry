import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippetPackageManager = (params: Params) => `
Install-Package Sentry.Google.Cloud.Functions -Version ${getPackageVersion(
  params,
  'sentry.dotnet.google-cloud-function',
  '3.34.0'
)}`;

const getInstallSnippetCoreCli = (params: Params) => `
dotnet add package Sentry.Google.Cloud.Functions -v ${getPackageVersion(
  params,
  'sentry.dotnet.google-cloud-function',
  '3.34.0'
)}`;

const getInstallSnippetManual = (params: Params) => `
<ItemGroup>
  <PackageReference Include="Sentry.Google.Cloud.Functions" Version="${getPackageVersion(
    params,
    'sentry.dotnet.google-cloud-function',
    '3.34.0'
  )}"/>
</ItemGroup>`;

const getConfigureCSharpSnippet = () => `
// Add the following line:
[assembly: FunctionsStartup(typeof(SentryStartup))]

public class Function : IHttpFunction
{
    public Task HandleAsync(HttpContext context)
    {
        // Your function code here.
    }
}`;

const getConfigureJsonSnippet = (params: Params) => `
{
  "Sentry": {
    "Dsn": "${params.dsn}",
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
}`;

const getVerifySnippet = () => `
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Sentry;

public Task HandleAsync(HttpContext context)
{
    SentrySdk.CaptureMessage("Hello Sentry");
}`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      configurations: [
        {
          description: tct(
            'Install the [strong:NuGet] package with Package Manager or .NET Core CLI:',
            {
              strong: <strong />,
            }
          ),
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: [
            {
              language: 'shell',
              label: 'Package Manager',
              value: 'packageManager',
              code: getInstallSnippetPackageManager(params),
            },
            {
              language: 'shell',
              label: '.NET Core CLI',
              value: 'coreCli',
              code: getInstallSnippetCoreCli(params),
            },
          ],
        },
        {
          language: 'xml',
          partialLoading: params.sourcePackageRegistries?.isLoading,
          description: t('Or, manually add the Sentry dependency into your csproj file:'),
          code: getInstallSnippetManual(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Then, add Sentry to the [functionCode:Function] class through [functionStartupCode:FunctionsStartup]:',
        {
          functionCode: <code />,
          functionStartupCode: <code />,
        }
      ),
      configurations: [
        {
          language: 'csharp',
          code: getConfigureCSharpSnippet(),
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
          code: getConfigureJsonSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t('To verify your setup, you can capture a message with the SDK:'),
      configurations: [
        {
          language: 'csharp',
          code: getVerifySnippet(),
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
  ],
};

const docs: Docs = {
  onboarding,
};

export default docs;

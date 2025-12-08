import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallSnippetPackageManager = (params: DocsParams) => `
Install-Package Sentry.Google.Cloud.Functions -Version ${getPackageVersion(
  params,
  'sentry.dotnet.google-cloud-function',
  '3.34.0'
)}`;

const getInstallSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry.Google.Cloud.Functions -v ${getPackageVersion(
  params,
  'sentry.dotnet.google-cloud-function',
  '3.34.0'
)}`;

const getInstallSnippetManual = (params: DocsParams) => `
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

const getConfigureJsonSnippet = (params: DocsParams) => `
{
  "Sentry": {
    "Dsn": "${params.dsn.public}",
    // Sends Cookies, User Id when one is logged on and user IP address to sentry. It's turned off by default.
    "SendDefaultPii": true,
    // When configuring for the first time, to see what the SDK is doing:
    "Debug": true,
    // Opt-in for payload submission.
    "MaxRequestBodySize": "Always"${
      params.isPerformanceSelected
        ? `,
    // Set TracesSampleRate to 1.0 to capture 100% of transactions for tracing.
    // We recommend adjusting this value in production.
    "TracesSampleRate": 1`
        : ''
    }
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

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install the [strong:NuGet] package with Package Manager or .NET Core CLI:',
            {
              strong: <strong />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Package Manager',
              language: 'shell',
              code: getInstallSnippetPackageManager(params),
            },
            {
              label: '.NET Core CLI',
              language: 'shell',
              code: getInstallSnippetCoreCli(params),
            },
          ],
        },
        {
          type: 'text',
          text: t('Or, manually add the Sentry dependency into your csproj file:'),
        },
        {
          type: 'code',
          language: 'xml',
          code: getInstallSnippetManual(params),
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
            'Then, add Sentry to the [code:Function] class through [code:FunctionsStartup]:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getConfigureCSharpSnippet(),
        },
        {
          type: 'text',
          text: tct(
            "Additionally, you'll need to set up your [code:Sentry] settings on [code:appsettings.json]:",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'json',
          code: getConfigureJsonSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t('To verify your setup, you can capture a message with the SDK:'),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getVerifySnippet(),
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
            tct('[link:Google Cloud Functions sample]', {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples/Sentry.Samples.Google.Cloud.Functions" />
              ),
            }),
            tct(
              '[link:Multiple samples in the [code:dotnet] SDK repository] [strong:(C#)]',
              {
                link: (
                  <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples" />
                ),
                strong: <strong />,
                code: <code />,
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

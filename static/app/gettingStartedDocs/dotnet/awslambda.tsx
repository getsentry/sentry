import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct(
      'Sentry provides an integration with AWS Lambda ASP.NET Core Server through the Sentry.AspNetCore NuGet package.',
      {
        link: <ExternalLink href="https://www.nuget.org/packages/Sentry.AspNetCore" />,
      }
    )}
  </p>
);
export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry dependency:'),
    configurations: [
      {
        language: 'powershell',
        code: 'Install-Package Sentry.AspNetCore -Version 3.34.0',
      },
      {
        language: 'shell',
        code: 'dotnet add package Sentry.AspNetCore -v 3.34.0',
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'You can combine this integration with a logging library like [strong:log4net, NLog, or Serilog] to include both request data as well as your logs as breadcrumbs. The logging ingrations also capture events when an error is logged.',
          {strong: <strong />}
        )}
      </p>
    ),
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <Fragment>
        <p>
          {tct(
            'All [code:ASP.NET Core] configurations are valid here. But one configuration in particular is relevant.',
            {
              code: <code />,
            }
          )}
        </p>
        <p>
          {tct(
            '[code:FlushOnCompletedRequest] ensures all events are flushed out. This is because the general ASP.NET Core hooks for when the process is exiting are not guaranteed to run in a serverless environment. This setting ensures that no event is lost if AWS recycles the process.',
            {
              code: <code />,
            }
          )}
        </p>
      </Fragment>
    ),
    configurations: [
      {
        language: 'csharp',
        code: `
public class LambdaEntryPoint : Amazon.Lambda.AspNetCoreServer.APIGatewayProxyFunction
{
    protected override void Init(IWebHostBuilder builder)
    {
        builder
            // Add Sentry
            .UseSentry(o =>
            {
              o.Dsn = "${dsn}";
              // When configuring for the first time, to see what the SDK is doing:
              o.Debug = true;
              // Required in Serverless environments
              o.FlushOnCompletedRequest = true;
              // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
                // We recommend adjusting this value in production.
              o.TracesSampleRate = 1.0;
            })
            .UseStartup<Startup>();
    }
}
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t('You can verify your setup by throwing an exception from a function:'),
    configurations: [
      {
        language: 'csharp',
        code: `
[Route("api/[controller]")]
public class BadController
{
  [HttpGet]
  public string Get() => throw null;
}
        `,
      },
      {
        language: 'shell',
        description: t('And make a request to that lambda:'),
        code: 'curl -X GET -I https://url.of.server.aws/api/bad',
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'Check out the [link:Sentry ASP.NET Core] documentation for the complete set of options.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/" />
            ),
          }
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedAwsLambda({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedAwsLambda;

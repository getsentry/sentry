import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `
defp deps do
  [
    # ...
    {:sentry, "~> 8.0"},
    {:jason, "~> 1.1"},
    {:hackney, "~> 1.8"},
    # if you are using plug_cowboy
    {:plug_cowboy, "~> 2.3"}
  ]
end`;

const getConfigureSnippet = (params: Params) => `
config :sentry,
dsn: "${params.dsn}",
environment_name: :prod,
enable_source_code_context: true,
root_source_code_path: File.cwd!(),
tags: %{
  env: "production"
},
included_environments: [:prod]`;

const getConfigureSnippetMixEnv = (params: Params) => `
config :sentry, dsn: "${params.dsn}",
included_environments: [:prod],
environment_name: Mix.env`;

const getCustomEnvironmentNameSnippet = (params: Params) => `
config :sentry, dsn: "${params.dsn}",
included_environments: ~w(production staging),
environment_name: System.get_env("RELEASE_LEVEL") || "development"`;

const getConfigureRouterSnippet = () => `
# Phoenix
use Sentry.PlugCapture
use Phoenix.Endpoint, otp_app: :my_app
# ...
plug Plug.Parsers,
  parsers: [:urlencoded, :multipart, :json],
  pass: ["*/*"],
  json_decoder: Phoenix.json_library()
plug Sentry.PlugContext
# Plug
use Plug.Router
use Sentry.PlugCapture
# ...
plug Plug.Parsers,
  parsers: [:urlencoded, :multipart, :json],
  pass: ["*/*"],
  json_decoder: Phoenix.json_library()
plug Sentry.PlugContext`;

const getCaptureExceptionSnippet = () => `
# lib/my_app/application.ex

def start(_type, _args) do
  Logger.add_backend(Sentry.LoggerBackend)`;

const getCaptureErrorsSnippet = () => `
try do
  ThisWillError.really()
rescue
  my_exception ->
    Sentry.capture_exception(my_exception, [stacktrace: __STACKTRACE__, extra: %{extra: information}])
end`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Edit your [mixCode:mix.exs] file to add it as a dependency and add the [sentryCode::sentry] package to your applications:',
        {sentryCode: <code />, mixCode: <code />}
      ),
      configurations: [
        {
          language: 'elixir',
          description: <p>{tct('Install [code:sentry-sdk]:', {code: <code />})}</p>,
          code: getInstallSnippet(),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Setup the application production environment in your [code:config/prod.exs]',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'elixir',
          code: getConfigureSnippet(params),
        },
        {
          description: (
            <Fragment>
              <p>
                {tct(
                  'The [environmentNameCode:environment_name] and [includedEnvironmentsCode:included_environments] work together to determine if and when Sentry should record exceptions. The [environmentNameCode:environment_name] is the name of the current environment. In the example above, we have explicitly set the environment to [prodCode::prod] which works well if you are inside an environment specific configuration like [configCode:config/prod.exs].',
                  {
                    environmentNameCode: <code />,
                    includedEnvironmentsCode: <code />,
                    prodCode: <code />,
                    configCode: <code />,
                  }
                )}
              </p>
              <p>
                {tct(
                  'An alternative is to use [code:Mix.env] in your general configuration file:',
                  {code: <code />}
                )}
              </p>
            </Fragment>
          ),
          configurations: [
            {
              language: 'elixir',
              code: getConfigureSnippetMixEnv(params),
            },
          ],
        },
        {
          description: (
            <Fragment>
              <p>
                {tct(
                  'This will set the environment name to whatever the current Mix environment atom is, but it will only send events if the current environment is [prodCode::prod], since that is the only entry in the [includedEnvironmentsCode:included_environments] key.',
                  {
                    prodCode: <code />,
                    includedEnvironmentsCode: <code />,
                  }
                )}
              </p>
              {t(
                "You can even rely on more custom determinations of the environment name. It's not uncommon for most applications to have a 'staging' environment. In order to handle this without adding an additional Mix environment, you can set an environment variable that determines the release level."
              )}
            </Fragment>
          ),
          language: 'elixir',
          code: getCustomEnvironmentNameSnippet(params),
        },
        {
          description: (
            <Fragment>
              <p>
                {tct(
                  "In this example, we are getting the environment name from the [code:RELEASE_LEVEL] environment variable. If that variable does not exist, it will default to [code:'development']. Now, on our servers, we can set the environment variable appropriately. On our local development machines, exceptions will never be sent, because the default value is not in the list of [code:included_environments].",
                  {
                    code: <code />,
                  }
                )}
              </p>
              <p>
                {tct(
                  'If using an environment with Plug or Phoenix, add the following to [plugRouterCode:Plug.Router] or [phoenixEndpointCode:Phoenix.Endpoint]:',
                  {plugRouterCode: <code />, phoenixEndpointCode: <code />}
                )}
              </p>
            </Fragment>
          ),
          language: 'elixir',
          code: getConfigureRouterSnippet(),
          additionalInfo: tct(
            '[sentryPlugContextCode:Sentry.PlugContext] gathers the contextual information for errors, and [sentryPlugCaptureCode:Sentry.PlugCapture] captures and sends any errors that occur in the Plug stack. [sentryPlugContextCode:Sentry.PlugContext] should be below [sentryPlugParsersCode:Plug.Parsers] if you are using it.',
            {
              sentryPlugCaptureCode: <code />,
              sentryPlugContextCode: <code />,
              sentryPlugParsersCode: <code />,
            }
          ),
        },
      ],
    },
    {
      title: t('Capture Crashed Process Exceptions'),
      description: tct(
        'This library comes with an extension to capture all error messages that the Plug handler might not. This is based on [link:Logger.Backend]. You can add it as a backend when your application starts:',
        {
          link: (
            <ExternalLink href="https://hexdocs.pm/logger/Logger.html#module-backends" />
          ),
        }
      ),
      configurations: [
        {
          language: 'elixir',
          code: getCaptureExceptionSnippet(),
        },
      ],
    },
    {
      title: t('Capturing Errors'),
      description: (
        <Fragment>
          {t(
            'If you use the LoggerBackend and set up the Plug/Phoenix integrations, all errors will bubble up to Sentry.'
          )}
          <p>{t('Otherwise, we provide a simple way to capture exceptions manually:')}</p>
        </Fragment>
      ),
      configurations: [
        {
          language: 'elixir',
          code: getCaptureErrorsSnippet(),
        },
      ],
    },
  ],
  verify: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;

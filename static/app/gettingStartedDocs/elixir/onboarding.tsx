import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getInstallSnippet = () => `
defp deps do
  [
    # ...
    {:sentry, "~> 10.2.0"},
    {:jason, "~> 1.2"},
    {:hackney, "~> 1.8"}
  ]
end`;

const getConfigureSnippet = (params: DocsParams) => `
  config :sentry,
  dsn: "${params.dsn.public}",
  environment_name: Mix.env(),
  enable_source_code_context: true,
  root_source_code_paths: [File.cwd!()]`;

const getPlugSnippet = () => `
 defmodule MyAppWeb.Endpoint
+  use Sentry.PlugCapture
   use Phoenix.Endpoint, otp_app: :my_app

   # ...

   plug Plug.Parsers,
     parsers: [:urlencoded, :multipart, :json],
     pass: ["*/*"],
     json_decoder: Phoenix.json_library()

+  plug Sentry.PlugContext`;

const getLoggerHandlerSnippet = () => `
# lib/my_app/application.ex

def start(_type, _args) do
  :logger.add_handler(:my_sentry_handler, Sentry.LoggerHandler, %{
    config: %{metadata: [:file, :line]}
  })
  # ...
end`;

const getVerifySnippet = () => `
try do
  a = 1 / 0
  IO.puts(a)
rescue
  my_exception ->
    Sentry.capture_exception(my_exception, stacktrace: __STACKTRACE__)
end`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Edit your [code:mix.exs] file to add it as a dependency and add the [code::sentry] package to your applications:',
            {code: <code />}
          ),
        },
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk]:'),
        },
        {
          type: 'code',
          language: 'elixir',
          code: getInstallSnippet(),
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
            'Setup the application production environment in your [code:config/prod.exs]',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'elixir',
          code: getConfigureSnippet(params),
        },
      ],
    },
    {
      title: t('Package Source Code'),
      content: [
        {
          type: 'text',
          text: tct(
            'Add a call to [code:mix sentry.package_source_code] in your release script to make sure the stacktraces you receive are complete.',
            {code: <code />}
          ),
        },
      ],
    },
    {
      title: t('Setup for Plug and Phoenix Applications'),
      content: [
        {
          type: 'text',
          text: tct(
            'You can capture errors in Plug (and Phoenix) applications with [code:Sentry.PlugContext] and [code:Sentry.PlugCapture]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'diff',
          code: getPlugSnippet(),
        },
        {
          type: 'text',
          text: tct(
            '[code:Sentry.PlugContext] gathers the contextual information for errors, and [code:Sentry.PlugCapture] captures and sends any errors that occur in the Plug stack.',
            {
              code: <code />,
            }
          ),
        },
      ],
    },
    {
      title: t('Capture Crashed Process Exceptions'),
      content: [
        {
          type: 'text',
          text: t(
            'This library comes with an extension to capture all error messages that the Plug handler might not. This is based on adding an erlang logger handler when your application starts:'
          ),
        },
        {
          type: 'code',
          language: 'elixir',
          code: getLoggerHandlerSnippet(),
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
          text: t('You can then report errors or messages to Sentry:'),
        },
        {
          type: 'code',
          language: 'elixir',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
};

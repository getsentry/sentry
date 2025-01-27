import {Fragment} from 'react';

import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportGenericInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `
defp deps do
  [
    # ...
    {:sentry, "~> 10.2.0"},
    {:jason, "~> 1.2"},
    {:hackney, "~> 1.8"}
  ]
end`;

const getConfigureSnippet = (params: Params) => `
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
  ThisWillError.really()
rescue
  my_exception ->
    Sentry.capture_exception(my_exception, stacktrace: __STACKTRACE__)
end`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Edit your [code:mix.exs] file to add it as a dependency and add the [code::sentry] package to your applications:',
        {code: <code />}
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
      ],
    },
    {
      title: t('Package Source Code'),
      description: tct(
        'Add a call to [code:mix sentry.package_source_code] in your release script to make sure the stacktraces you receive are complete.',
        {code: <code />}
      ),
    },
    {
      title: t('Setup for Plug and Phoenix Applications'),
      description: (
        <Fragment>
          <p>
            {tct(
              'You can capture errors in Plug (and Phoenix) applications with [code:Sentry.PlugContext] and [code:Sentry.PlugCapture]:',
              {
                code: <code />,
              }
            )}
          </p>
        </Fragment>
      ),
      configurations: [
        {
          language: 'diff',
          code: getPlugSnippet(),
        },
      ],
      additionalInfo: tct(
        '[code:Sentry.PlugContext] gathers the contextual information for errors, and [code:Sentry.PlugCapture] captures and sends any errors that occur in the Plug stack.',
        {
          code: <code />,
        }
      ),
    },
    {
      title: t('Capture Crashed Process Exceptions'),
      description: t(
        'This library comes with an extension to capture all error messages that the Plug handler might not. This is based on adding an erlang logger handler when your application starts:'
      ),
      configurations: [
        {
          language: 'elixir',
          code: getLoggerHandlerSnippet(),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t('You can then report errors or messages to Sentry:'),
      configurations: [
        {
          language: 'elixir',

          code: getVerifySnippet(),
        },
      ],
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportGenericInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/elixir/user-feedback/configuration/#crash-report-modal',
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
  feedbackOnboardingJsLoader,
};

export default docs;

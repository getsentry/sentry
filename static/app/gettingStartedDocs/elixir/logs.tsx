import {ExternalLink} from '@sentry/scraps/link';

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
    {:sentry, "~> 14.1"},
    {:jason, "~> 1.4"},
    {:finch, "~> 0.21"}
  ]
end`;

const getConfigureSnippet = (params: DocsParams) => `
config :sentry,
  dsn: "${params.dsn.public}",
  environment_name: Mix.env(),
  logs: [
    level: :info,
    metadata: [:request_id, :user_id]
  ]`;

const getVerifySnippet = () => `
require Logger

Logger.info("This is a test log from Elixir")
Logger.warning("Something might be wrong", user_id: 42)
Logger.error("An error occurred")`;

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'This setup needs [code:sentry] version [code:14.0.0] or later. Make sure your [code:mix.exs] specifies at least this version:',
            {code: <code />}
          ),
        },
        {type: 'code', language: 'elixir', code: getInstallSnippet()},
        {
          type: 'text',
          text: tct('Then fetch the updated dependency: [code:mix deps.get]', {
            code: <code />,
          }),
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
            'Enable logs by setting [code:level] in the [code:logs] option of your Sentry configuration in [code:config/config.exs] (or [code:config/prod.exs]). Logs at that level and above are sent to Sentry. When [code:logs] is set, the SDK automatically attaches a [code:Sentry.LoggerHandler] on startup — no manual setup required.',
            {code: <code />}
          ),
        },
        {type: 'code', language: 'elixir', code: getConfigureSnippet(params)},
        {
          type: 'text',
          text: tct(
            'For more configuration options, see the [link:Elixir Logs documentation].',
            {link: <ExternalLink href="https://docs.sentry.io/platforms/elixir/logs/" />}
          ),
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
          text: t(
            'Verify that logging is working by sending a few log messages via the Elixir Logger:'
          ),
        },
        {type: 'code', language: 'elixir', code: getVerifySnippet()},
        {
          type: 'text',
          text: t(
            'Wait a moment, then check the Logs section in Sentry to confirm the messages arrived.'
          ),
        },
      ],
    },
  ],
};

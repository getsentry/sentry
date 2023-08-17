import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = tct(
  'The Starlette integration adds support for the Starlette Framework.',
  {
    link: <ExternalLink href="https://www.starlette.io/" />,
  }
);
export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryStarletteCode:starlette] extra:',
          {
            sentrySdkCode: <code />,
            sentryStarletteCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: "pip install --upgrade 'sentry-sdk[starlette]'",
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'To configure the SDK, initialize it before your app has been initialized. The Sentry SDK automatically enables support for Starlette if you have the [code:starlette] Python package installed in your project. There are no configuration options you need to add when initializing the Sentry SDK as everything works out of the box:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
from starlette.applications import Starlette

import sentry_sdk


sentry_sdk.init(
    dsn="${dsn}",

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)

app = Starlette(routes=[...])
      `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'The above configuration captures both error and performance data. To reduce the volume of performance data captured, change [code:traces_sample_rate] to a value between 0 and 1.',
          {
            code: <code />,
          }
        )}
      </p>
    ),
  },
  {
    type: StepType.VERIFY,
    description: t(
      'You can easily verify your Sentry installation by creating a route that triggers an error:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
from starlette.applications import Starlette
from starlette.routing import Route


async def trigger_error(request):
  division_by_zero = 1 / 0

app = Starlette(routes=[
  Route("/sentry-debug", trigger_error),
])
    `,
        additionalInfo: t(
          'Visiting this route will trigger an error that will be captured by Sentry.'
        ),
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithStarlette({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithStarlette;

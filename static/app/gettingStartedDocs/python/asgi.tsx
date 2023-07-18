import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct(
      'The ASGI middleware can be used to instrument any [link:ASGI-compatible web framework] to attach request data for your events.',
      {
        link: <ExternalLink href="https://asgi.readthedocs.io/en/latest/" />,
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
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'This can be used to instrument, for example [starletteLink:Starlette] or [djangoLink:Django Channels 2.0].',
          {
            starletteLink: <ExternalLink href="https://www.starlette.io/middleware/" />,
            djangoLink: (
              <ExternalLink href="https://channels.readthedocs.io/en/latest/" />
            ),
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from myapp import asgi_app

sentry_sdk.init(
    dsn="${dsn}",
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)

asgi_app = SentryAsgiMiddleware(asgi_app)
        `,
      },
    ],
    additionalInfo: t('The middleware supports both ASGI 2 and ASGI 3 transparently.'),
  },
];
// Configuration End

export function GettingStartedWithASGI({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithASGI;

import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <Fragment>
    <p>
      {tct(
        'The Sanic integration adds support for the [link:Sanic Web Framework]. We support the following versions:',
        {
          link: <ExternalLink href="https://github.com/sanic-org/sanic" />,
        }
      )}
    </p>
    <List symbol="bullet">
      <ListItem>0.8</ListItem>
      <ListItem>18.12</ListItem>
      <ListItem>19.12</ListItem>
      <ListItem>20.12</ListItem>
      <ListItem>{t('Any version of the form "x.12" (LTS versions).')}</ListItem>
    </List>
    <p>
      {tct(
        '[strong:We do support all versions of Sanic]. However, Sanic versions between LTS releases should be considered Early Adopter. We may not support all the features in these non-LTS versions, since non-LTS versions change quickly and [link:have introduced breaking changes in the past], without prior notice.',
        {
          strong: <strong />,
          link: <ExternalLink href="https://github.com/sanic-org/sanic/issues/1532" />,
        }
      )}
    </p>
    {t('A Python version of "3.6" or greater is also required.')}
  </Fragment>
);

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: <p>{tct('Install [code:sentry-sdk] from PyPI:', {code: <code />})}</p>,
    configurations: [
      {
        language: 'bash',
        code: '$ pip install --upgrade sentry-sdk',
      },
      {
        description: (
          <p>
            {tct(
              "f you're on Python 3.6, you also need the [code:aiocontextvars] package:",
              {
                code: <code />,
              }
            )}
          </p>
        ),
        language: 'bash',
        code: '$ pip install --upgrade aiocontextvars',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      'To configure the SDK, initialize it with the integration before or after your app has been initialized:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.sanic import SanicIntegration
from sanic import Sanic

sentry_sdk.init(
    dsn="${dsn}",
    integrations=[
      SanicIntegration(),
    ],

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)

app = Sanic(__name__)
      `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithSanic({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithSanic;

import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const failingAction = `
export const userError = action(async () => {
    throw new Error("I failed you!");
});
`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Set up Sentry in your Convex project [link:deployment settings].',
        {
          link: (
            <ExternalLink href="https://docs.convex.dev/production/integrations/exception-reporting#configuring-sentry" />
          ),
        }
      ),
      configurations: [],
    },
  ],
  configure: () => [],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: (
        <Fragment>
          {t(
            'One way to verify your setup is by calling an action that throws intentionally.'
          )}
          <p>{t('Calling an undefined function will throw an exception:')}</p>
        </Fragment>
      ),
      configurations: [
        {
          language: 'javascript',
          code: failingAction,
        },
        {
          language: 'bash',
          code: 'npx convex run myModule:userError',
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
};

export default docs;

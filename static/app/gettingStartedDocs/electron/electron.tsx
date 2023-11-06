import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
import * as Sentry from "@sentry/electron";

Sentry.init({
  dsn: "${params.dsn}",
});`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: t('Add the Sentry Electron SDK package as a dependency:'),
      configurations: [
        {
          code: [
            {
              label: 'npm',
              value: 'npm',
              language: 'bash',
              code: 'npm install --save @sentry/electron',
            },
            {
              label: 'yarn',
              value: 'yarn',
              language: 'bash',
              code: 'yarn add @sentry/electron',
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        `You need to call [codeInit:Sentry.init] in the [codeMain:main] process and in every [codeRenderer:renderer] process you spawn.
           For more details about configuring the Electron SDK [docsLink:click here].`,
        {
          codeInit: <code />,
          codeMain: <code />,
          codeRenderer: <code />,
          docsLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/electron/" />
          ),
        }
      ),
      configurations: [
        {
          language: 'javascript',
          code: getConfigureSnippet(params),
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/',
      ...params,
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        `One way to verify your setup is by intentionally causing an error that breaks your application.`
      ),
      configurations: [
        {
          description: t(
            `Calling an undefined function will throw a JavaScript exception:`
          ),
          language: 'javascript',
          code: 'myUndefinedFunction();',
        },
        {
          description: t(
            `With Electron you can test native crash reporting by triggering a crash:`
          ),
          language: 'javascript',
          code: 'process.crash();',
        },
      ],
      additionalInfo: t(
        'You may want to try inserting these code snippets into both your main and any renderer processes to verify Sentry is operational in both.'
      ),
    },
  ],
};
const docs: Docs = {
  onboarding,
};

export default docs;

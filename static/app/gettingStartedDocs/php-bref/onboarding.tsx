import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {onboarding as laravelOnboarding} from 'sentry/gettingStartedDocs/php-laravel/onboarding';
import {onboarding as symfonyOnboarding} from 'sentry/gettingStartedDocs/php-symfony/onboarding';
import {onboarding as phpOnboarding} from 'sentry/gettingStartedDocs/php/onboarding';
import {t, tct} from 'sentry/locale';

import {Framework, type Params, type PlatformOptions} from './utils';

// sentry/sentry-bref extends the SDK of the framework, so each guide starts with
// that framework's setup and adds the Bref parts to it.
const frameworkOnboarding: Record<Framework, OnboardingConfig> = {
  [Framework.LARAVEL]: laravelOnboarding,
  [Framework.SYMFONY]: symfonyOnboarding,
  [Framework.PHP]: phpOnboarding,
};

const getFrameworkOnboarding = (params: Params) =>
  frameworkOnboarding[params.platformOptions.framework];

// Places the Bref package right after the framework's `composer require`, ahead of
// the framework-specific setup that follows it.
const insertAfterFirstCodeBlock = (
  steps: OnboardingStep[],
  content: ContentBlock[]
): OnboardingStep[] =>
  steps.map((step, index) => {
    if (index !== 0) {
      return step;
    }
    const codeIndex = step.content.findIndex(block => block.type === 'code');
    return {
      ...step,
      content: step.content.toSpliced(codeIndex + 1, 0, ...content),
    };
  });

const getRuntimeDsnSnippet = (params: Params) => {
  const dsnVariable =
    params.platformOptions.framework === Framework.LARAVEL
      ? 'SENTRY_LARAVEL_DSN'
      : 'SENTRY_DSN';

  return `provider:
  environment:
    ${dsnVariable}: ${params.dsn.public}`;
};

const getFrameworkIntegrationContent = (params: Params): ContentBlock[] => {
  switch (params.platformOptions.framework) {
    case Framework.LARAVEL:
      return [
        {
          type: 'text',
          text: t(
            "Laravel discovers the Bref integration's service provider automatically, so it needs no extra configuration."
          ),
        },
      ];
    case Framework.SYMFONY:
      return [
        {
          type: 'text',
          text: tct('Register the Bref bundle in [code:config/bundles.php]:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'php',
          code: `return [
    // ...
    Sentry\\Bref\\Symfony\\BrefSentryBundle::class => ['all' => true],
];`,
        },
      ];
    case Framework.PHP:
      return [
        {
          type: 'text',
          text: tct(
            'Add the [code:Sentry\\Bref\\Psr15\\BrefSentryMiddleware] PSR-15 middleware to your HTTP middleware stack.',
            {code: <code />}
          ),
        },
      ];
  }
};

export const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => (
    <p>
      {tct(
        '[brefLink:Bref] runs PHP applications on AWS Lambda. The [code:sentry/sentry-bref] package adds Lambda errors that happen outside PHP-FPM (like timeouts), event handlers, cold starts, and AWS SDK calls to the Sentry SDK for PHP, Laravel, or Symfony. It needs Bref 3 and PHP 8.2 or later.',
        {
          brefLink: <ExternalLink href="https://bref.sh" />,
          code: <code />,
        }
      )}
    </p>
  ),
  install: params =>
    insertAfterFirstCodeBlock(getFrameworkOnboarding(params).install(params), [
      {
        type: 'text',
        text: tct('Then install the [code:sentry/sentry-bref] package:', {
          code: <code />,
        }),
      },
      {
        type: 'code',
        language: 'bash',
        code: 'composer require sentry/sentry-bref',
      },
    ]),
  configure: params => [
    ...getFrameworkOnboarding(params).configure(params),
    {
      title: t('Configure Bref'),
      content: [
        ...(params.platformOptions.framework === Framework.PHP
          ? []
          : ([
              {
                type: 'text',
                text: tct(
                  'Your Lambda functions need the DSN at runtime. Deploy it in your [code:.env] file, or set it as an environment variable in [code:serverless.yml]:',
                  {code: <code />}
                ),
              },
              {
                type: 'code',
                language: 'yaml',
                code: getRuntimeDsnSnippet(params),
              },
            ] satisfies ContentBlock[])),
        ...getFrameworkIntegrationContent(params),
        {
          type: 'conditional',
          condition: params.isPerformanceSelected,
          content: [
            {
              type: 'text',
              text: t(
                'The integration adds cold starts and AWS SDK calls as spans to your transactions.'
              ),
            },
          ],
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content:
        params.platformOptions.framework === Framework.PHP
          ? [
              {
                type: 'text',
                text: t(
                  'Deploy your application, then throw an exception in one of your routes or event handlers:'
                ),
              },
              {
                type: 'code',
                language: 'php',
                code: `throw new \\Exception('My first Sentry error!');`,
              },
            ]
          : [
              {
                type: 'text',
                text: tct(
                  'Deploy your application, then run the [code:sentry:test] command on Lambda:',
                  {code: <code />}
                ),
              },
              {
                type: 'code',
                language: 'bash',
                code: 'serverless bref:cli --args="sentry:test"',
              },
              {
                type: 'text',
                text: tct(
                  'With [brefCloudLink:Bref Cloud], run [code:bref command "sentry:test"] instead. The test event shows up in Sentry with the details of the Lambda function and a link to the logs of the invocation in CloudWatch.',
                  {
                    brefCloudLink: <ExternalLink href="https://bref.sh/cloud" />,
                    code: <code />,
                  }
                ),
              },
            ],
    },
  ],
  nextSteps: () => [
    {
      id: 'bref-usage',
      name: t('Usage'),
      description: t(
        'Learn what the integration reports for Lambda errors and event handlers.'
      ),
      link: 'https://docs.sentry.io/platforms/php/guides/bref/usage/',
    },
    {
      id: 'bref-aws-sdk',
      name: t('AWS SDK'),
      description: t('Trace your AWS SDK calls.'),
      link: 'https://docs.sentry.io/platforms/php/guides/bref/tracing/aws-sdk/',
    },
  ],
};

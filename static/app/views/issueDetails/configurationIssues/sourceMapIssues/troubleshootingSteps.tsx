import {LinkButton} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';

import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

import type {SourceMapDiagnosis} from './sourceMapDiagnosis';

function getRecommendedStep(diagnosis: SourceMapDiagnosis): OnboardingStep | undefined {
  switch (diagnosis.type) {
    case 'dist-mismatch':
      return {
        title: t('Match the Distribution Value'),
        content: [
          {
            type: 'text',
            text:
              diagnosis.dist === null
                ? tct(
                    'Upload your build artifacts to Sentry using a matching [dist] value or adjust the [dist] value in your SDK options.',
                    {dist: <InlineCode>dist</InlineCode>}
                  )
                : tct(
                    'Upload your build artifacts to Sentry using the dist [dist] or adjust the dist value in your SDK options.',
                    {dist: <InlineCode>{diagnosis.dist}</InlineCode>}
                  ),
          },
        ],
      };
    case 'missing-source':
      return {
        title: t('Upload the Missing Source File'),
        content: [
          {
            type: 'text',
            text: tct(
              'Upload the deployed source file [file] and its source map. Check that the uploaded artifact name matches the path in the sample event.',
              {file: <InlineCode>{diagnosis.path}</InlineCode>}
            ),
          },
        ],
      };
    case 'missing-map':
      return {
        title: t('Upload the Referenced Source Map'),
        content: [
          {
            type: 'text',
            text: tct(
              'The source file references [reference]. Generate and upload the corresponding source map, and check that its artifact name matches that reference.',
              {reference: <InlineCode>{diagnosis.reference}</InlineCode>}
            ),
          },
        ],
      };
    case 'fetch-failure':
      return {
        title: t('Check Source File Access'),
        content: [
          {
            type: 'text',
            text: tct(
              'Sentry could not fetch [url] ([reason]). Check that this URL is correct and accessible to Sentry. You can also upload the build artifacts directly to Sentry.',
              {url: <InlineCode>{diagnosis.url}</InlineCode>, reason: diagnosis.reason}
            ),
          },
        ],
      };
    case 'no-artifacts':
    case 'unknown':
    default:
      return undefined;
  }
}

export function getTroubleshootingSteps(
  settingsUrl: string,
  diagnosis?: SourceMapDiagnosis
): OnboardingStep[] {
  const steps: OnboardingStep[] = [
    {
      title: t('Verify Artifacts Are Uploaded'),
      content: [
        {
          type: 'text',
          text: t(
            'For Sentry to de-minify your stack traces you must provide both the minified files (for example, app.min.js) and the corresponding source maps. You can find them at:'
          ),
        },
        {
          type: 'custom',
          content: (
            <LinkButton
              size="sm"
              variant="primary"
              icon={<IconSettings />}
              to={settingsUrl}
            >
              {t('Settings')}
            </LinkButton>
          ),
          markdown: `[${t('Settings')}](${settingsUrl})`,
        },
      ],
    },
    {
      title: t("Verify That You're Building Source Maps"),
      content: [
        {
          type: 'text',
          text: tct(
            'Bundlers and tools (like [tsc]) that generate code, often require you to manually set specific options to generate source maps.',
            {tsc: <InlineCode>tsc</InlineCode>}
          ),
        },
        {
          type: 'text',
          text: tct(
            'If you followed one of our tool-specific guides, verify you configured your tool to emit source maps and that the source maps contain your original source code in the [sourcesContent] field.',
            {sourcesContent: <InlineCode>sourcesContent</InlineCode>}
          ),
        },
      ],
    },
    {
      title: t("Verify That You're Running a Production Build"),
      content: [
        {
          type: 'text',
          text: t(
            'When running JavaScript build tools (like webpack, Vite, ...) in development-mode/watch-mode, the generated code is sometimes incompatible with our source map uploading processes.'
          ),
        },
        {
          type: 'text',
          text: t(
            'We recommend, especially when testing locally, to run a production build to verify your source maps uploading setup.'
          ),
        },
      ],
    },
    {
      title: t('Verify Your Source Files Contain Debug ID Injection Snippets'),
      content: [
        {
          type: 'text',
          text: tct(
            'In the JavaScript files you uploaded to Sentry, search for code that roughly looks like [snippet]. This code snippet might look different depending on how you process your code.',
            {
              snippet: (
                <InlineCode>{'e._sentryDebugIds=e._sentryDebugIds||{}'}</InlineCode>
              ),
            }
          ),
        },
        {
          type: 'text',
          text: t(
            'If this code exists in a bundle, that bundle will be able to be matched to a source file. Every bundle you deploy in your app needs to have this snippet in order to be correctly source mapped.'
          ),
        },
        {
          type: 'text',
          text: tct(
            "If your source code does not contain this snippet and you're using a Sentry plugin for your bundler, please check that you are using the latest version and please verify that the plugin is correctly processing your files. Set the [debug] option to [true] to print useful debugging information.",
            {debug: <InlineCode>debug</InlineCode>, true: <InlineCode>true</InlineCode>}
          ),
        },
        {
          type: 'text',
          text: tct(
            "If you're using the Sentry CLI, verify that you're running the [inject] command before you upload to Sentry and before you deploy your files.",
            {inject: <InlineCode>inject</InlineCode>}
          ),
        },
      ],
    },
  ];
  const recommended = diagnosis && getRecommendedStep(diagnosis);
  return recommended ? [recommended, ...steps] : steps;
}

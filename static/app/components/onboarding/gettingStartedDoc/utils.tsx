import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {tct} from 'sentry/locale';

export function getUploadSourceMapsStep(guideLink: string) {
  return {
    language: 'bash',
    type: StepType.UPLOAD_SOURCE_MAPS,
    description: tct(
      'Automatically upload your source maps to enable readable stack traces for Errors. If you prefer to manually set up source maps, please follow [guideLink:this guide].',
      {
        guideLink: <ExternalLink href={guideLink} />,
      }
    ),
    configurations: [
      {
        code: `npx @sentry/wizard@latest -i sourcemaps`,
      },
    ],
  };
}

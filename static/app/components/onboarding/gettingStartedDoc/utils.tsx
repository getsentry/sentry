import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

export function getUploadSourceMapsStep(guideLink: string) {
  return {
    title: t('Upload Source Maps'),
    description: (
      <p>
        {tct(
          'Automatically upload your source maps to enable readable stack traces for Errors. If you prefer to manually set up source maps, please follow [guideLink:this guide].',
          {
            guideLink: <ExternalLink href={guideLink} />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: `npx @sentry/wizard@latest -i sourcemaps`,
      },
    ],
  };
}

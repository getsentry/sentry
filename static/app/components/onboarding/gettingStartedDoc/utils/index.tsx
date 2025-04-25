import ExternalLink from 'sentry/components/links/externalLink';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getSourceMapsWizardSnippet} from 'sentry/utils/gettingStartedDocs/sourceMapsWizard';

export function getUploadSourceMapsStep({
  guideLink,
  organization,
  platformKey,
  projectId,
  newOrg,
  isSelfHosted,
  title,
  description,
  ...rest
}: DocsParams & {
  description?: React.ReactNode;
  guideLink?: string;
  title?: string;
}) {
  return {
    title: title ?? t('Upload Source Maps'),
    description: description ?? (
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
      getSourceMapsWizardSnippet({
        organization,
        platformKey,
        projectId,
        newOrg,
        isSelfHosted,
        ...rest,
      } as DocsParams),
    ],
  };
}

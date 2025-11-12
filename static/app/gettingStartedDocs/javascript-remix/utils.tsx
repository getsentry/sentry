import {ExternalLink} from 'sentry/components/core/link';
import type {
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export function getInstallContent({
  isSelfHosted,
  organization,
  project,
}: DocsParams): ContentBlock[] {
  return [
    {
      type: 'text',
      text: tct(
        'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
        {
          wizardLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/#install" />
          ),
        }
      ),
    },
    {
      type: 'code',
      language: 'bash',
      code: `npx @sentry/wizard@latest -i remix ${isSelfHosted ? '' : '--saas'}  --org ${organization.slug} --project ${project.slug}`,
    },
  ];
}

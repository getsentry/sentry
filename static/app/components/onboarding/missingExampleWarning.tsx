import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import platforms from 'sentry/data/platforms';
import {tct} from 'sentry/locale';
import type {OnboardingPlatformDoc} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/project';

/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */
const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

export function MissingExampleWarning({
  platformDocs,
  platform,
}: {
  platform: PlatformKey | null;
  platformDocs: OnboardingPlatformDoc | null;
}) {
  const missingExample = platformDocs?.html.includes(INCOMPLETE_DOC_FLAG);

  if (!missingExample) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert type="warning" showIcon>
        {tct(
          `Looks like this getting started example is still undergoing some
         work and doesn't include an example for triggering an event quite
         yet. If you have trouble sending your first event be sure to consult
         the [docsLink:full documentation] for [platform].`,
          {
            docsLink: <ExternalLink href={platformDocs?.link} />,
            platform: platforms.find(p => p.id === platform)?.name,
          }
        )}
      </Alert>
    </Alert.Container>
  );
}

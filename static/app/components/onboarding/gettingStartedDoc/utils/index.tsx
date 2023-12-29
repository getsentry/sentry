import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Organization, PlatformKey} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

export function getUploadSourceMapsStep({
  guideLink,
  organization,
  platformKey,
  projectId,
  newOrg,
}: {
  guideLink: string;
  newOrg?: boolean;
  organization?: Organization;
  platformKey?: PlatformKey;
  projectId?: string;
}) {
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
        onCopy: () => {
          if (!organization || !projectId || !platformKey) {
            return;
          }

          trackAnalytics(
            newOrg
              ? 'onboarding.source_maps_wizard_button_copy_clicked'
              : 'project_creation.source_maps_wizard_button_copy_clicked',
            {
              project_id: projectId,
              platform: platformKey,
              organization,
            }
          );
        },
        onSelectAndCopy: () => {
          if (!organization || !projectId || !platformKey) {
            return;
          }

          trackAnalytics(
            newOrg
              ? 'onboarding.source_maps_wizard_selected_and_copied'
              : 'project_creation.source_maps_wizard_selected_and_copied',
            {
              project_id: projectId,
              platform: platformKey,
              organization,
            }
          );
        },
      },
    ],
  };
}

export const getReplayConfigureDescription = ({link}: {link: string}) =>
  tct(
    'Add the following to your SDK config. There are several privacy and sampling options available, all of which can be set using the [code:integrations] constructor. Learn more about configuring Session Replay by reading the [link:configuration docs].',
    {
      code: <code />,
      link: <ExternalLink href={link} />,
    }
  );

export const getReplayJsLoaderSdkSetupSnippet = params => `
<script>
  Sentry.onLoad(function() {
    Sentry.init({
      integrations: [
        new Sentry.Replay(${getReplayConfigOptions(params.replayConfigOptions)}),
      ],
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    });
  });
</script>`;

export const getReplaySDKSetupSnippet = ({
  importStatement,
  dsn,
  mask,
  block,
}: {
  dsn: string;
  importStatement: string;
  block?: boolean;
  mask?: boolean;
}) =>
  `${importStatement}

  Sentry.init({
    dsn: "${dsn}",

    integrations: [
      new Sentry.Replay(${getReplayConfigOptions({
        mask,
        block,
      })}),
    ],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  });`;

export const getReplayConfigOptions = ({
  mask,
  block,
}: {
  block?: boolean;
  mask?: boolean;
} = {}) => {
  if (mask && block) {
    return ``;
  }
  if (mask) {
    return `{
          blockAllMedia: false,
        }`;
  }
  if (block) {
    return `{
          maskAllText: false,
        }`;
  }
  return `{
          maskAllText: false,
          blockAllMedia: false,
        }`;
};

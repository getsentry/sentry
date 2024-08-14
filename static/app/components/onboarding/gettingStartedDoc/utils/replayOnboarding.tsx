import ExternalLink from 'sentry/components/links/externalLink';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export const getReplayConfigureDescription = ({link}: {link: string}) =>
  tct(
    'Add the following to your SDK config. There are several privacy and sampling options available, all of which can be set using the [code:integrations] constructor. Learn more about configuring Session Replay by reading the [link:configuration docs].',
    {
      code: <code />,
      link: <ExternalLink href={link} />,
    }
  );

export const getReplayJsLoaderSdkSetupSnippet = (params: DocsParams) => `
<script>
  Sentry.onLoad(function() {
    Sentry.init({
      integrations: [
        Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)}),
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
      Sentry.replayIntegration(${getReplayConfigOptions({
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

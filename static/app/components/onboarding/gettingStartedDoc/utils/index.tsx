import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {
  docsFlowVariantParams,
  resolveDocsFlowEvent,
  SOURCE_MAPS_COPY_CLICKED_EVENT,
  SOURCE_MAPS_SELECTED_AND_COPIED_EVENT,
} from 'sentry/components/onboarding/gettingStartedDoc/docsFlowAnalytics';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconCopyId} from 'sentry/icons/iconCopyId';
import {t, tct} from 'sentry/locale';
import type {ProjectKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getSourceMapsWizardSnippet} from 'sentry/utils/getSourceMapsWizardSnippet';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

export function getUploadSourceMapsStep({
  guideLink,
  organization,
  platformKey,
  project,
  docsFlow,
  isSelfHosted,
  description,
}: DocsParams & {
  description?: React.ReactNode;
  guideLink?: string;
}): OnboardingStep {
  function trackEvent(eventName: string) {
    trackAnalytics(eventName, {
      project_id: project.id,
      platform: platformKey,
      organization,
      ...docsFlowVariantParams(docsFlow),
    });
  }

  return {
    collapsible: true,
    title: t('Upload Source Maps (Optional)'),
    content: [
      {
        type: 'text',
        text:
          description ??
          tct(
            'Automatically upload your source maps to enable readable stack traces for Errors. If you prefer to manually set up source maps, please follow [guideLink:this guide].',
            {
              guideLink: <ExternalLink href={guideLink} />,
            }
          ),
      },
      {
        type: 'custom',
        content: (
          <OnboardingCodeSnippet
            language="bash"
            onCopy={() =>
              trackEvent(resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, docsFlow))
            }
            onSelectAndCopy={() =>
              trackEvent(
                resolveDocsFlowEvent(SOURCE_MAPS_SELECTED_AND_COPIED_EVENT, docsFlow)
              )
            }
          >
            {getSourceMapsWizardSnippet({
              isSelfHosted,
              organization,
              project,
            })}
          </OnboardingCodeSnippet>
        ),
      },
    ],
  };
}

const DEFAULT_DATA_COLLECTION_SNIPPET = `Sentry.init({
  // ...
  dataCollection: {
    userInfo: false,
    // other options
  },
});`;

/**
 * Presents `dataCollection` as its own setup step, as required by the SDK
 * data collection spec. Init snippets must not carry a commented-out
 * `dataCollection` override instead.
 *
 * @param docsLink Link to the `dataCollection` options of the platform or guide.
 * @param code Init snippet, for platforms that do not configure the SDK through `Sentry.init`.
 * @param description Replaces the default summary of what the SDK collects, for
 *   products that collect a more specific category, such as generative AI content.
 * @param collapsible Set to `false` for the guided `GuidedSteps` flows, which drop
 *   every collapsible step and render the rest as numbered steps.
 */
export function getDataCollectionStep({
  docsLink,
  code,
  description,
  collapsible = true,
}: {
  docsLink: string;
  code?: string;
  collapsible?: boolean;
  description?: React.ReactNode;
}): OnboardingStep {
  const summary: ContentBlock[] = description
    ? [{type: 'text', text: description}]
    : [
        {
          type: 'text',
          text: t(
            'By default, the SDK sends user identity data (IP address, ID, and similar) and other data like HTTP bodies and URL query parameters. This gives you rich debugging context.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'The SDK always filters sensitive values whose keys match a built-in denylist, such as [authCode:auth] or [passwordCode:password], and sends [filtered] instead.',
            {
              authCode: <code />,
              passwordCode: <code />,
              filtered: <code>[Filtered]</code>,
            }
          ),
        },
      ];

  return {
    collapsible,
    title: t('Control the Data You Send to Sentry (Optional)'),
    content: [
      ...summary,
      {
        type: 'text',
        text: tct(
          "To send less data, turn off the categories you don't need in the [code:dataCollection] option. For the full list of categories and their defaults, see [link:the dataCollection options].",
          {
            code: <code />,
            link: <ExternalLink href={docsLink} />,
          }
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: code ?? DEFAULT_DATA_COLLECTION_SNIPPET,
          },
        ],
      },
    ],
  };
}

const SENTRY_INSTRUMENT_SKILL_URL = 'https://skills.sentry.dev/instrument';

function CopyPromptButton({prompt}: {prompt: string}) {
  const {copy} = useCopyToClipboard();
  return (
    <Button
      size="xs"
      icon={<IconCopy />}
      onClick={() => copy(prompt, {successMessage: t('Prompt copied to clipboard')})}
    >
      {t('Copy Prompt')}
    </Button>
  );
}

export function getAISetupStep({sdkName}: {sdkName?: string}): OnboardingStep {
  const target = sdkName ? `the Sentry ${sdkName} SDK` : 'Sentry';
  const prompt = `Use curl to download, read and follow ${SENTRY_INSTRUMENT_SKILL_URL} to set up ${target}.`;

  return {
    collapsible: true,
    title: t('AI-Assisted Setup (Optional)'),
    trailingItems: <CopyPromptButton prompt={prompt} />,
    content: [
      {
        type: 'text',
        text: t(
          'If you want your AI coding assistant to help you set up Sentry, copy this prompt and paste it into your agent:'
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'Prompt',
            language: 'text',
            code: prompt,
          },
        ],
      },
    ],
  };
}

function CopyDsnButton({
  dsn,
  onCopyDsn,
}: {
  dsn: ProjectKey['dsn'];
  onCopyDsn?: () => void;
}) {
  const {copy} = useCopyToClipboard();

  return (
    <Button
      size="xs"
      icon={<IconCopyId />}
      onClick={() =>
        copy(dsn.public, {successMessage: t('DSN copied to clipboard')}).then(onCopyDsn)
      }
    >
      {t('Copy DSN')}
    </Button>
  );
}

export function injectCopyDsnButtonIntoFirstConfigureStep({
  configureSteps,
  dsn,
  onCopyDsn,
}: {
  configureSteps: OnboardingStep[];
  dsn: ProjectKey['dsn'];
  onCopyDsn?: () => void;
}): OnboardingStep[] {
  const [firstStep, ...otherSteps] = configureSteps;

  if (!firstStep) {
    return configureSteps;
  }

  const copyDsnButton = <CopyDsnButton dsn={dsn} onCopyDsn={onCopyDsn} />;

  const firstStepWithDsnButton: OnboardingStep = {
    ...firstStep,
    trailingItems: firstStep.trailingItems ? (
      <Fragment>
        {copyDsnButton}
        {firstStep.trailingItems}
      </Fragment>
    ) : (
      copyDsnButton
    ),
  };

  return [firstStepWithDsnButton, ...otherSteps];
}

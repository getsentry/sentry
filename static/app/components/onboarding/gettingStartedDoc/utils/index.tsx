import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconCopy} from 'sentry/icons/iconCopy';
import {t, tct} from 'sentry/locale';
import type {ProjectKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getSourceMapsWizardSnippet} from 'sentry/utils/getSourceMapsWizardSnippet';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

export function getUploadSourceMapsStep({
  guideLink,
  organization,
  platformKey,
  project,
  newOrg,
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
              trackEvent(
                newOrg
                  ? 'onboarding.source_maps_wizard_button_copy_clicked'
                  : 'project_creation.source_maps_wizard_button_copy_clicked'
              )
            }
            onSelectAndCopy={() =>
              trackEvent(
                newOrg
                  ? 'onboarding.source_maps_wizard_selected_and_copied'
                  : 'project_creation.source_maps_wizard_selected_and_copied'
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

const SENTRY_FOR_AI_BASE_URL =
  'https://github.com/getsentry/sentry-for-ai/blob/main/skills';

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

export function getAISetupStep({skillPath}: {skillPath: string}): OnboardingStep {
  const skillUrl = `${SENTRY_FOR_AI_BASE_URL}/${skillPath}/SKILL.md`;
  const prompt = `Read and follow: ${skillUrl}`;

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
      icon={<IconCopy />}
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

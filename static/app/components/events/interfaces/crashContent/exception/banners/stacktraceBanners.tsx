import {useMemo} from 'react';

import type {PromptResponse} from 'sentry/actionCreators/prompts';
import {
  makePromptsCheckQueryKey,
  promptsUpdate,
  usePromptsCheck,
} from 'sentry/actionCreators/prompts';
import useStacktraceLink from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import {hasFileExtension} from 'sentry/components/events/interfaces/frame/utils';
import type {
  Event,
  Frame,
  Organization,
  StacktraceLinkResult,
  StacktraceType,
} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {AddCodecovBanner} from './addCodecovBanner';
import {AddIntegrationBanner} from './addIntegrationBanner';

function shouldShowCodecovPrompt(
  organization: Organization,
  stacktraceLink: StacktraceLinkResult
) {
  const enabled =
    organization.features.includes('codecov-integration') && !organization.codecovAccess;

  return enabled && stacktraceLink.config?.provider.key === 'github';
}

function getPromptStatus(promptData: ReturnType<typeof usePromptsCheck>, key: string) {
  return promptData.isSuccess && promptData.data.features
    ? promptIsDismissed({
        dismissedTime: promptData.data.features[key]?.dismissed_ts,
        snoozedTime: promptData.data.features[key]?.snoozed_ts,
      })
    : false;
}

const integrationPromptKey = 'stacktrace_link';
const codecovPromptKey = 'codecov_stacktrace_prompt';

interface StacktraceBannersProps {
  event: Event;
  stacktrace: StacktraceType;
}

export function StacktraceBanners({stacktrace, event}: StacktraceBannersProps) {
  const organization = useOrganization({allowNull: true});
  const api = useApi();
  const queryClient = useQueryClient();
  const {projects} = useProjects();
  const expectedDefaultFrame: Frame | undefined = (stacktrace.frames ?? [])
    .filter(
      frame => frame?.inApp && hasFileExtension(frame.absPath || frame.filename || '')
    )
    .at(-1);
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

  const enabled = !!organization && !!expectedDefaultFrame && !!project;

  const {data: stacktraceLink} = useStacktraceLink(
    {
      event,
      frame: expectedDefaultFrame ?? {},
      orgSlug: organization?.slug!,
      projectSlug: project?.slug!,
    },
    {
      enabled,
    }
  );
  const promptKeys = organization?.features.includes('codecov-integration')
    ? [integrationPromptKey, codecovPromptKey]
    : integrationPromptKey;
  const prompt = usePromptsCheck(
    {
      organization: organization!,
      feature: promptKeys,
      projectId: project?.id,
    },
    {
      enabled,
    }
  );

  if (!enabled || !stacktraceLink) {
    return null;
  }

  const dismissPrompt = (key: string) => {
    promptsUpdate(api, {
      organization,
      projectId: project?.id,
      feature: key,
      status: 'dismissed',
    });

    // Update cached query data
    // Will set prompt to dismissed
    setApiQueryData<PromptResponse>(
      queryClient,
      makePromptsCheckQueryKey({
        organization,
        feature: promptKeys,
        projectId: project?.id,
      }),
      () => {
        const dimissedTs = new Date().getTime() / 1000;
        return {
          data: {dismissed_ts: dimissedTs},
          features: {[key]: {dismissed_ts: dimissedTs}},
        };
      }
    );
  };

  // No integrations installed, show banner
  if (
    stacktraceLink.integrations.length === 0 &&
    !getPromptStatus(prompt, integrationPromptKey)
  ) {
    return (
      <AddIntegrationBanner
        orgSlug={organization.slug}
        onDismiss={() => {
          dismissPrompt(integrationPromptKey);
          trackAnalytics('integrations.stacktrace_link_cta_dismissed', {
            view: 'stacktrace_issue_details',
            organization,
            ...getAnalyticsDataForEvent(event),
          });
        }}
      />
    );
  }

  if (
    shouldShowCodecovPrompt(organization, stacktraceLink) &&
    !getPromptStatus(prompt, codecovPromptKey)
  ) {
    return (
      <AddCodecovBanner
        orgSlug={organization.slug}
        onClick={() => {
          trackAnalytics('integrations.stacktrace_codecov_prompt_clicked', {
            view: 'stacktrace_link',
            organization,
          });
        }}
        onDismiss={() => {
          dismissPrompt(codecovPromptKey);
        }}
      />
    );
  }

  return null;
}

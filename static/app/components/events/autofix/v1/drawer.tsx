import {useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {SeerDrawerBody} from 'sentry/components/events/autofix/drawer/drawerBody';
import {SeerDrawerHeader} from 'sentry/components/events/autofix/drawer/drawerHeader';
import {SeerDrawerNavigator} from 'sentry/components/events/autofix/drawer/drawerNavigator';
import {SeerWelcomeScreen} from 'sentry/components/events/autofix/drawer/welcomeScreen';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v1/content';
import {AiSetupConfiguration} from 'sentry/components/events/autofix/v2/autofixConfigureSeer';
import Placeholder from 'sentry/components/placeholder';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

interface SeerDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function SeerDrawer({event, group, project}: SeerDrawerProps) {
  const aiConfig = useAiConfig(group, project);
  const aiAutofix = useAiAutofix(group, event);

  const handleReset = useHandleReset({aiAutofix, aiConfig});

  return (
    <Flex
      className="seer-drawer-container"
      position="relative"
      direction="column"
      background="secondary"
    >
      <SeerDrawerHeader group={group} project={project} event={event} />
      <SeerDrawerNavigator
        project={project}
        showCopyMarkdown={false}
        onReset={handleReset}
      />
      <SeerDrawerBody>
        <InnerSeerDrawer
          group={group}
          project={project}
          event={event}
          aiAutofix={aiAutofix}
          aiConfig={aiConfig}
        />
      </SeerDrawerBody>
    </Flex>
  );
}

interface InnerSeerDrawerProps extends SeerDrawerProps {
  aiAutofix: ReturnType<typeof useAiAutofix>;
  aiConfig: ReturnType<typeof useAiConfig>;
}

function InnerSeerDrawer({
  event,
  group,
  project,
  aiAutofix,
  aiConfig,
}: InnerSeerDrawerProps) {
  const organization = useOrganization();
  const {isPending, data} = useSeerOnboardingCheck();

  const seatBasedSeer = organization.features.includes('seat-based-seer-enabled');

  const noAutofixQuota =
    !aiConfig.hasAutofixQuota && organization.features.includes('seer-billing');

  if (aiConfig.isAutofixSetupLoading || (seatBasedSeer && isPending)) {
    return (
      <Flex data-test-id="ai-setup-loading-indicator" direction="column" gap="xl">
        <Placeholder height="10rem" />
        <Placeholder height="15rem" />
        <Placeholder height="15rem" />
      </Flex>
    );
  }

  if (seatBasedSeer) {
    // No easy way to add a hook for only configuring quotas.
    // So the condition here captures all the possible cases
    // that requires some kind of configuration change.
    //
    // Instead, we bundle all the configuration into 1 hook.
    //
    // If the hook is not defined, we always direct them to
    // the seer configs.
    //
    // If the hook is defined, the hook will render a different
    // component as needed to configure quotas.
    if (
      // needs to configure quota
      noAutofixQuota ||
      // needs to configure repos
      !aiConfig.seerReposLinked ||
      !data?.hasSupportedScmIntegration
    ) {
      return <AiSetupConfiguration event={event} group={group} project={project} />;
    }
  } else if (
    // Handle welcome/consent screen at the top level
    aiConfig.orgNeedsGenAiAcknowledgement ||
    noAutofixQuota
  ) {
    return <SeerWelcomeScreen group={group} project={project} event={event} />;
  }

  return (
    <SeerDrawerContent
      group={group}
      project={project}
      event={event}
      aiAutofix={aiAutofix}
      aiConfig={aiConfig}
    />
  );
}

function useHandleReset({
  aiAutofix,
  aiConfig,
}: {
  aiAutofix: ReturnType<typeof useAiAutofix>;
  aiConfig: ReturnType<typeof useAiConfig>;
}) {
  return useMemo(() => {
    if (!aiAutofix.autofixData) {
      return undefined;
    }
    return () => {
      aiAutofix.reset();
      aiConfig.refetchAutofixSetup?.();
    };
  }, [aiAutofix, aiConfig]);
}

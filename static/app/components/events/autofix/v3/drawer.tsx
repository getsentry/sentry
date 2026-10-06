import {Stack} from '@sentry/scraps/layout';

import {SeerDrawerBody} from 'sentry/components/events/autofix/v3/body';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v3/content';
import {SeerDrawerHeader} from 'sentry/components/events/autofix/v3/header';
import {useSeerPanel} from 'sentry/components/events/autofix/v3/useSeerPanel';
import {AutofixWarnings} from 'sentry/components/events/autofix/v3/warnings';
import {Placeholder} from 'sentry/components/placeholder';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useAutoScroll} from 'sentry/utils/useAutoScroll';

interface SeerDrawerProps {
  group: Group;
  project: Project;
}

export function SeerDrawer({group, project}: SeerDrawerProps) {
  const {
    aiConfig,
    autofix,
    enableBashMode,
    handleCopyMarkdown,
    handleOpenSeerAgent,
    handleRestart,
    referrer,
    runState,
    setEnableBashMode,
    warnings,
  } = useSeerPanel({group, project});
  const {containerRef, onScrollHandler} = useAutoScroll({key: runState});

  return (
    <Stack
      className="seer-drawer-container"
      position="relative"
      height="100%"
      overflowY="hidden"
      background="secondary"
    >
      <SeerDrawerHeader
        autofixState={runState}
        enableBashMode={enableBashMode}
        onCopyMarkdown={handleCopyMarkdown}
        onEnableBashModeChange={setEnableBashMode}
        onOpenSeerAgent={handleOpenSeerAgent}
        onReset={handleRestart}
        referrer={referrer}
      />
      <AutofixWarnings warnings={warnings} groupId={group.id} />
      <SeerDrawerBody ref={containerRef} onScroll={onScrollHandler}>
        {aiConfig.isAutofixSetupLoading ? (
          <Stack data-test-id="ai-setup-loading-indicator" gap="xl">
            <Placeholder height="10rem" />
            <Placeholder height="15rem" />
            <Placeholder height="15rem" />
          </Stack>
        ) : (
          <SeerDrawerContent group={group} autofix={autofix} aiConfig={aiConfig} />
        )}
      </SeerDrawerBody>
    </Stack>
  );
}

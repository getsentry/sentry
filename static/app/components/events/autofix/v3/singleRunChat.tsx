import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {IconBot} from '@sentry/icons/bot';
import {useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import type {ComposerValue} from '@sentry/scraps/composer';
import {Flex, Stack} from '@sentry/scraps/layout';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  explorerAutofixApiOptions,
  type ExplorerAutofixState,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {SeerExplorerTranscript} from 'sentry/views/seerExplorer/components/chat/transcript';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import {InputSection} from 'sentry/views/seerExplorer/components/inputSection';
import {
  PendingUserInputDock,
  PendingUserInputPicker,
} from 'sentry/views/seerExplorer/components/pendingUserInputDock';
import {usePendingUserInput} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import {useSeerExplorer} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {SeerExplorerRunScopedProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import type {Block, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

const EMPTY_INPUT: ComposerValue = {text: '', mentions: []};

function withoutKickoffPrompt(blocks: Block[]): Block[] {
  const firstReply = blocks.findIndex(block => block.message.role !== 'user');
  return firstReply === -1 ? [] : blocks.slice(firstReply);
}

interface SingleRunChatProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  children: ReactNode;
  groupId: string;
}

export function SingleRunChat({autofix, children, groupId}: SingleRunChatProps) {
  const organization = useOrganization();
  const {openSeerExplorerDrawer} = useSeerExplorerDrawer();
  const runId = getAutofixRunId(autofix.runState);

  if (isSeerExplorerEnabled(organization) && defined(runId)) {
    return (
      <SeerExplorerRunScopedProvider key={runId} runId={runId}>
        <SingleRunLiveChat
          runId={runId}
          groupId={groupId}
          onOpenInExplorer={() => openSeerExplorerDrawer({runId})}
        >
          {children}
        </SingleRunLiveChat>
      </SeerExplorerRunScopedProvider>
    );
  }

  return (
    <SingleRunTranscript runId={runId} runState={autofix.runState}>
      {children}
    </SingleRunTranscript>
  );
}

function SingleRunTranscript({
  children,
  runId,
  runState,
}: {
  children: ReactNode;
  runId: SeerExplorerRunId | undefined;
  runState: ExplorerAutofixState | null;
}) {
  const {getPageReferrer} = usePageReferrer();
  const blocks = useMemo(() => withoutKickoffPrompt(runState?.blocks ?? []), [runState]);

  return (
    <Stack gap="lg">
      {blocks.length ? (
        <SeerExplorerTranscript
          blocks={blocks}
          runId={runId}
          readOnly
          showThinking={false}
          getPageReferrer={getPageReferrer}
        />
      ) : (
        runState?.status === 'processing' && <Placeholder height="15rem" />
      )}
      {runState?.status === 'error' && (
        <Alert variant="danger">{t('Autofix ran into an error and stopped.')}</Alert>
      )}
      {children}
    </Stack>
  );
}

function SingleRunLiveChat({
  children,
  groupId,
  onOpenInExplorer,
  runId,
}: {
  children: ReactNode;
  groupId: string;
  onOpenInExplorer: () => void;
  runId: SeerExplorerRunId;
}) {
  const organization = useOrganization();
  const user = useUser();
  const queryClient = useQueryClient();
  const {getPageReferrer} = usePageReferrer();
  const {
    sessionData,
    isPolling,
    sendMessage,
    interruptRun,
    hasSentInterrupt,
    respondToUserInput,
  } = useSeerExplorer();
  const [inputValue, setInputValue] = useState<ComposerValue>(EMPTY_INPUT);
  const composerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  const blocks = useMemo(
    () => withoutKickoffPrompt(sessionData?.blocks ?? []),
    [sessionData?.blocks]
  );
  const readOnly = sessionData?.owner_user_id?.toString() !== user.id;
  const isAwaitingUserInput = sessionData?.status === 'awaiting_user_input';
  const pendingInput = sessionData?.pending_user_input ?? null;
  const pendingUserInputState = usePendingUserInput({
    isAwaitingUserInput,
    pendingInput,
    respondToUserInput,
    scrollContainerRef,
    userScrolledUpRef,
  });

  const wasPollingRef = useRef(isPolling);
  useEffect(() => {
    if (wasPollingRef.current && !isPolling) {
      queryClient.invalidateQueries({
        queryKey: explorerAutofixApiOptions(organization.slug, groupId).queryKey,
      });
    }
    wasPollingRef.current = isPolling;
  }, [isPolling, queryClient, organization.slug, groupId]);

  const canSendMessage = !readOnly && !isPolling && !!inputValue.text.trim();
  const handleSend = () => {
    if (!canSendMessage) {
      return;
    }
    sendMessage(inputValue.text.trim());
    setInputValue(EMPTY_INPUT);
  };

  const {
    isFileApprovalPending,
    fileApprovalIndex,
    fileApprovalTotalPatches,
    handleFileApprovalApprove,
    handleFileApprovalReject,
    isQuestionPending,
    questionIndex,
    totalQuestions,
    currentQuestion,
    canSubmitQuestion,
    handleQuestionNext,
    handleQuestionBack,
    handleQuestionMoveUp,
    handleQuestionMoveDown,
  } = pendingUserInputState;

  return (
    <Stack gap="lg" ref={scrollContainerRef}>
      {blocks.length ? (
        <SeerExplorerTranscript
          blocks={blocks}
          runId={runId}
          readOnly={readOnly}
          showThinking={false}
          getPageReferrer={getPageReferrer}
          pendingInput={pendingInput}
          interactionPending={isFileApprovalPending || isQuestionPending}
        />
      ) : (
        (!sessionData || isPolling) && <Placeholder height="15rem" />
      )}
      {sessionData?.status === 'error' && (
        <Alert variant="danger">{t('Autofix ran into an error and stopped.')}</Alert>
      )}
      {children}
      <Flex>
        <Button size="sm" icon={<IconBot />} onClick={onOpenInExplorer}>
          {t('Open in Seer Explorer')}
        </Button>
      </Flex>
      <PendingUserInputDock>
        <PendingUserInputPicker
          isAwaitingUserInput={isAwaitingUserInput}
          pendingInput={pendingInput}
          pendingUserInputState={pendingUserInputState}
          readOnly={readOnly}
          respondToUserInput={respondToUserInput}
          runId={runId}
        />
      </PendingUserInputDock>
      <InputSection
        enabled={!readOnly}
        disabledPlaceholder={t('Only the person who started this run can reply.')}
        inputValue={inputValue}
        canSendMessage={canSendMessage}
        interruptState={
          isPolling && hasSentInterrupt
            ? 'requested'
            : isPolling
              ? 'can-interrupt'
              : hasSentInterrupt
                ? 'completed'
                : 'disabled'
        }
        onInputChange={setInputValue}
        onInputClick={() => {}}
        onInterrupt={interruptRun}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
          }
        }}
        onSend={handleSend}
        repoPRStates={sessionData?.repo_pr_states ?? {}}
        runId={runId}
        composerRef={composerRef}
        fileApprovalActions={
          isFileApprovalPending && fileApprovalIndex < fileApprovalTotalPatches
            ? {
                currentIndex: fileApprovalIndex,
                totalPatches: fileApprovalTotalPatches,
                onApprove: handleFileApprovalApprove,
                onReject: handleFileApprovalReject,
              }
            : undefined
        }
        questionActions={
          isQuestionPending && currentQuestion
            ? {
                currentIndex: questionIndex,
                totalQuestions,
                canSubmit: canSubmitQuestion,
                onNext: handleQuestionNext,
                onBack: handleQuestionBack,
                onMoveUp: handleQuestionMoveUp,
                onMoveDown: handleQuestionMoveDown,
              }
            : undefined
        }
      />
    </Stack>
  );
}

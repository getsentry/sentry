import React, {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Flex} from 'sentry/components/core/layout';
import {TextArea} from 'sentry/components/core/textarea';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {AutofixStepFeedback} from 'sentry/components/events/autofix/autofixStepFeedback';
import {
  AutofixStatus,
  type AutofixRootCauseData,
  type AutofixRootCauseSelection,
  type CodingAgentState,
  type CommentThread,
} from 'sentry/components/events/autofix/types';
import {
  makeAutofixQueryKey,
  useCodingAgentIntegrations,
  useLaunchCodingAgent,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {formatRootCauseWithEvent} from 'sentry/components/events/autofix/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChat, IconChevron, IconCopy, IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

import AutofixHighlightPopup from './autofixHighlightPopup';
import {AutofixTimeline} from './autofixTimeline';

function useSelectRootCause({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;

  return useMutation({
    mutationFn: (params: {cause_id: string; instruction?: string}) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'select_root_cause',
              cause_id: params.cause_id,
              instruction: params.instruction || null,
            },
          },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, true),
      });
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, false),
      });
      addLoadingMessage(t('On it...'));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when selecting the root cause.'));
    },
  });
}

type AutofixRootCauseProps = {
  causes: AutofixRootCauseData[];
  groupId: string;
  rootCauseSelection: AutofixRootCauseSelection;
  runId: string;
  status: AutofixStatus;
  agentCommentThread?: CommentThread;
  codingAgents?: Record<string, CodingAgentState>;
  event?: Event;
  isRootCauseFirstAppearance?: boolean;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  terminationReason?: string;
};

const cardAnimationProps: MotionNodeAnimationOptions = {
  exit: {opacity: 0, height: 0, scale: 0.8, y: -20},
  initial: {opacity: 0, height: 0, scale: 0.8},
  animate: {opacity: 1, height: 'auto', scale: 1},
  transition: testableTransition({
    duration: 1.0,
    height: {
      type: 'spring',
      bounce: 0.2,
    },
    scale: {
      type: 'spring',
      bounce: 0.2,
    },
    y: {
      type: 'tween',
      ease: 'easeOut',
    },
  }),
};

export function replaceHeadersWithBold(markdown: string) {
  const headerRegex = /^(#{1,6})\s+(.*)$/gm;
  const boldMarkdown = markdown.replace(headerRegex, (_match, _hashes, content) => {
    return ` **${content}** `;
  });

  return boldMarkdown;
}

function RootCauseDescription({
  cause,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
  ref,
}: {
  cause: AutofixRootCauseData;
  groupId: string;
  runId: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <CauseDescription>
      {cause.description && (
        <AutofixHighlightWrapper
          ref={ref}
          groupId={groupId}
          runId={runId}
          stepIndex={previousDefaultStepIndex ?? 0}
          retainInsightCardIndex={
            previousInsightCount !== undefined && previousInsightCount >= 0
              ? previousInsightCount
              : null
          }
        >
          <Description
            dangerouslySetInnerHTML={{__html: singleLineRenderer(cause.description)}}
          />
        </AutofixHighlightWrapper>
      )}
      {cause.root_cause_reproduction && (
        <AutofixTimeline
          events={cause.root_cause_reproduction}
          eventCodeUrls={cause.reproduction_urls}
          groupId={groupId}
          runId={runId}
          stepIndex={previousDefaultStepIndex ?? 0}
          retainInsightCardIndex={
            previousInsightCount !== undefined && previousInsightCount >= 0
              ? previousInsightCount
              : null
          }
        />
      )}
    </CauseDescription>
  );
}

export function formatRootCauseText(
  cause: AutofixRootCauseData | undefined,
  customRootCause?: string
) {
  if (!cause && !customRootCause) {
    return '';
  }

  if (customRootCause) {
    return `# Root Cause of the Issue\n\n${customRootCause}`;
  }

  if (!cause) {
    return '';
  }

  const parts: string[] = ['# Root Cause of the Issue'];

  if (cause.description) {
    parts.push(cause.description);
  }

  if (cause.root_cause_reproduction) {
    parts.push(
      cause.root_cause_reproduction
        .map(event => {
          const eventParts = [`### ${event.title}`];

          if (event.code_snippet_and_analysis) {
            eventParts.push(event.code_snippet_and_analysis);
          }

          if (event.relevant_code_file) {
            eventParts.push(`(See @${event.relevant_code_file.file_path})`);
          }

          return eventParts.join('\n');
        })
        .join('\n\n')
    );
  }

  return parts.join('\n\n');
}

function CopyRootCauseButton({
  cause,
  customRootCause,
  event,
}: {
  cause?: AutofixRootCauseData;
  customRootCause?: string;
  event?: Event;
}) {
  const text = formatRootCauseWithEvent(cause, customRootCause, event);
  const {copy} = useCopyToClipboard();

  return (
    <Button
      size="sm"
      title="Copy analysis as Markdown / LLM prompt"
      onClick={() => copy(text, {successMessage: t('Analysis copied to clipboard.')})}
      analyticsEventName="Autofix: Copy Root Cause as Markdown"
      analyticsEventKey="autofix.root_cause.copy"
      icon={<IconCopy />}
    >
      {t('Copy')}
    </Button>
  );
}

function SolutionActionButton({
  cursorIntegrations,
  preferredAction,
  primaryButtonPriority,
  isSelectingRootCause,
  isLaunchingAgent,
  isLoadingAgents,
  submitFindSolution,
  handleLaunchCodingAgent,
  findSolutionTitle,
}: {
  cursorIntegrations: CodingAgentIntegration[];
  findSolutionTitle: string;
  handleLaunchCodingAgent: (integrationId: string, integrationName: string) => void;
  isLaunchingAgent: boolean;
  isLoadingAgents: boolean;
  isSelectingRootCause: boolean;
  preferredAction: string;
  primaryButtonPriority: React.ComponentProps<typeof Button>['priority'];
  submitFindSolution: () => void;
}) {
  const preferredIntegration = preferredAction.startsWith('cursor:')
    ? cursorIntegrations.find(i => i.id === preferredAction.replace('cursor:', ''))
    : null;

  const effectivePreference =
    preferredAction === 'seer_solution' || !preferredIntegration
      ? 'seer_solution'
      : preferredAction;

  const isSeerPreferred = effectivePreference === 'seer_solution';

  // Check if there are duplicate names among integrations (need to show ID to distinguish)
  const hasDuplicateNames =
    cursorIntegrations.length > 1 &&
    new Set(cursorIntegrations.map(i => i.name)).size < cursorIntegrations.length;

  // If no integrations, show simple Seer button
  if (cursorIntegrations.length === 0) {
    return (
      <Button
        size="sm"
        priority={primaryButtonPriority}
        busy={isSelectingRootCause}
        onClick={submitFindSolution}
        title={findSolutionTitle}
      >
        {t('Find Solution')}
      </Button>
    );
  }

  const dropdownItems = [
    ...(isSeerPreferred
      ? []
      : [
          {
            key: 'seer_solution',
            label: t('Find Solution with Seer'),
            onAction: submitFindSolution,
            disabled: isSelectingRootCause,
          },
        ]),
    // Show all integrations except the currently preferred one
    ...cursorIntegrations
      .filter(integration => `cursor:${integration.id}` !== effectivePreference)
      .map(integration => ({
        key: `cursor:${integration.id}`,
        label: (
          <Flex gap="md" align="center">
            <PluginIcon pluginId="cursor" size={20} />
            <div>{t('Send to %s', integration.name)}</div>
            {hasDuplicateNames && (
              <SmallIntegrationIdText>({integration.id})</SmallIntegrationIdText>
            )}
          </Flex>
        ),
        onAction: () => handleLaunchCodingAgent(integration.id, integration.name),
        disabled: isLoadingAgents || isLaunchingAgent,
      })),
  ];

  const primaryButtonLabel = isSeerPreferred
    ? t('Find Solution with Seer')
    : hasDuplicateNames
      ? t('Send to %s (%s)', preferredIntegration!.name, preferredIntegration!.id)
      : t('Send to %s', preferredIntegration!.name);

  const primaryButtonProps = isSeerPreferred
    ? {
        onClick: submitFindSolution,
        busy: isSelectingRootCause,
        icon: undefined,
        children: primaryButtonLabel,
      }
    : {
        onClick: () =>
          handleLaunchCodingAgent(preferredIntegration!.id, preferredIntegration!.name),
        busy: isLaunchingAgent,
        icon: <PluginIcon pluginId="cursor" size={16} />,
        children: primaryButtonLabel,
      };

  return (
    <ButtonBar merged gap="0">
      <Button
        size="sm"
        priority={primaryButtonPriority}
        disabled={isLoadingAgents}
        {...primaryButtonProps}
      >
        {primaryButtonProps.children}
      </Button>
      <DropdownMenu
        items={dropdownItems}
        trigger={(triggerProps, isOpen) => (
          <DropdownTrigger
            {...triggerProps}
            size="sm"
            priority={primaryButtonPriority}
            busy={isSelectingRootCause || isLaunchingAgent}
            disabled={isLoadingAgents}
            aria-label={t('More solution options')}
            icon={
              isSelectingRootCause || isLaunchingAgent ? (
                <LoadingIndicator size={12} />
              ) : (
                <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
              )
            }
          />
        )}
      />
    </ButtonBar>
  );
}

function AutofixRootCauseDisplay({
  causes,
  groupId,
  runId,
  rootCauseSelection,
  status,
  previousDefaultStepIndex,
  previousInsightCount,
  agentCommentThread,
  codingAgents,
  event,
}: AutofixRootCauseProps) {
  const cause = causes[0];
  const organization = useOrganization();
  const iconFocusRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const [solutionText, setSolutionText] = useState('');
  const {mutate: selectRootCause, isPending: isSelectingRootCause} = useSelectRootCause({
    groupId,
    runId,
  });
  const {data: codingAgentResponse, isLoading: isLoadingAgents} =
    useCodingAgentIntegrations();
  const codingAgentIntegrations = codingAgentResponse?.integrations ?? [];
  const {mutate: launchCodingAgent, isPending: isLaunchingAgent} = useLaunchCodingAgent(
    groupId,
    runId
  );

  // Stores 'seer_solution' or an integration ID (e.g., 'cursor:123')
  const [preferredAction, setPreferredAction] = useLocalStorageState<string>(
    'autofix:rootCauseActionPreference',
    'seer_solution'
  );

  const handleSelectDescription = () => {
    if (descriptionRef.current) {
      // Simulate a click on the description to trigger the text selection
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      descriptionRef.current.dispatchEvent(clickEvent);
    }
  };

  const submitFindSolution = () => {
    if (cause?.id === undefined || cause.id === null) {
      addErrorMessage(t('No root cause available.'));
      return;
    }

    // Save user preference
    setPreferredAction('seer_solution');

    const instruction = solutionText.trim();

    if (instruction) {
      selectRootCause({
        cause_id: cause.id,
        instruction,
      });
    } else {
      selectRootCause({
        cause_id: cause.id,
      });
    }

    setSolutionText('');

    trackAnalytics('autofix.root_cause.find_solution', {
      organization,
      group_id: groupId,
      instruction_provided: instruction.length > 0,
    });
  };

  const cursorIntegrations = codingAgentIntegrations.filter(
    integration => integration.provider === 'cursor'
  );

  const handleLaunchCodingAgent = (integrationId: string, integrationName: string) => {
    const targetIntegration = cursorIntegrations.find(i => i.id === integrationId);

    if (!targetIntegration) {
      return;
    }

    // Save user preference with specific integration ID
    setPreferredAction(`cursor:${integrationId}`);

    addLoadingMessage(t('Launching %s...', integrationName), {
      duration: 60000,
    });

    const instruction = solutionText.trim();

    launchCodingAgent({
      integrationId: targetIntegration.id,
      agentName: targetIntegration.name,
      triggerSource: 'root_cause',
      instruction: instruction || undefined,
    });

    setSolutionText('');

    trackAnalytics('autofix.coding_agent.launch_from_root_cause', {
      organization,
      group_id: groupId,
    });
  };

  // Shared UI state for solution action controls
  const isRootCauseAlreadySelected = Boolean(
    rootCauseSelection && 'cause_id' in rootCauseSelection
  );
  const hasCodingAgents = Boolean(codingAgents && Object.keys(codingAgents).length > 0);
  const primaryButtonPriority: React.ComponentProps<typeof Button>['priority'] =
    isRootCauseAlreadySelected || hasCodingAgents ? 'default' : 'primary';
  const findSolutionTitle = t('Let Seer plan a solution to this issue');

  if (!cause) {
    return (
      <Alert.Container>
        <Alert variant="danger">{t('No root cause available.')}</Alert>
      </Alert.Container>
    );
  }

  if (rootCauseSelection && 'custom_root_cause' in rootCauseSelection) {
    return (
      <CausesContainer>
        <CustomRootCausePadding>
          <HeaderWrapper>
            <HeaderText>
              <Flex justify="center" align="center" ref={iconFocusRef}>
                <IconFocus size="md" color="pink400" />
              </Flex>
              {t('Custom Root Cause')}
            </HeaderText>
          </HeaderWrapper>
          <CauseDescription>{rootCauseSelection.custom_root_cause}</CauseDescription>
          <BottomDivider />
          <BottomButtonContainer>
            <ButtonBar>
              <CopyRootCauseButton
                customRootCause={rootCauseSelection.custom_root_cause}
                event={event}
              />
            </ButtonBar>
            {status === AutofixStatus.COMPLETED && (
              <AutofixStepFeedback
                stepType="root_cause"
                groupId={groupId}
                runId={runId}
              />
            )}
          </BottomButtonContainer>
        </CustomRootCausePadding>
      </CausesContainer>
    );
  }

  return (
    <CausesContainer>
      <HeaderWrapper>
        <HeaderText>
          <Flex justify="center" align="center" ref={iconFocusRef}>
            <IconFocus size="md" color="pink400" />
          </Flex>
          {t('Root Cause')}
          <Button
            size="zero"
            borderless
            title={t('Chat with Seer')}
            onClick={handleSelectDescription}
            analyticsEventName="Autofix: Root Cause Chat"
            analyticsEventKey="autofix.root_cause.chat"
          >
            <IconChat />
          </Button>
        </HeaderText>
      </HeaderWrapper>
      <AnimatePresence>
        {agentCommentThread && iconFocusRef.current && (
          <AutofixHighlightPopup
            selectedText=""
            referenceElement={iconFocusRef.current}
            groupId={groupId}
            runId={runId}
            stepIndex={previousDefaultStepIndex ?? 0}
            retainInsightCardIndex={
              previousInsightCount !== undefined && previousInsightCount >= 0
                ? previousInsightCount
                : null
            }
            isAgentComment
            blockName={t('Seer is uncertain of the root cause...')}
          />
        )}
      </AnimatePresence>
      <Content>
        <Fragment>
          <RootCauseDescription
            cause={cause}
            groupId={groupId}
            runId={runId}
            previousDefaultStepIndex={previousDefaultStepIndex}
            previousInsightCount={previousInsightCount}
            ref={descriptionRef}
          />
        </Fragment>
      </Content>
      <BottomDivider />
      <BottomButtonContainer>
        <SolutionInput
          autosize
          value={solutionText}
          maxLength={4096}
          onChange={e => setSolutionText(e.target.value)}
          placeholder={t('Add context for the solution...')}
          maxRows={3}
          size="sm"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitFindSolution();
            }
          }}
        />
        <ButtonBar>
          <CopyRootCauseButton cause={cause} event={event} />
          <SolutionActionButton
            cursorIntegrations={cursorIntegrations}
            preferredAction={preferredAction}
            primaryButtonPriority={primaryButtonPriority}
            isSelectingRootCause={isSelectingRootCause}
            isLaunchingAgent={isLaunchingAgent}
            isLoadingAgents={isLoadingAgents}
            submitFindSolution={submitFindSolution}
            handleLaunchCodingAgent={handleLaunchCodingAgent}
            findSolutionTitle={findSolutionTitle}
          />
        </ButtonBar>
        {status === AutofixStatus.COMPLETED && (
          <AutofixStepFeedback stepType="root_cause" groupId={groupId} runId={runId} />
        )}
      </BottomButtonContainer>
    </CausesContainer>
  );
}

export function AutofixRootCause(props: AutofixRootCauseProps) {
  if (props.causes.length === 0) {
    return (
      <AnimatePresence initial={props.isRootCauseFirstAppearance}>
        <AnimationWrapper key="card" {...cardAnimationProps}>
          <NoCausesPadding>
            <Alert.Container>
              <Alert variant="warning">
                {t('No root cause found.\n\n%s', props.terminationReason ?? '')}
              </Alert>
            </Alert.Container>
          </NoCausesPadding>
        </AnimationWrapper>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={props.isRootCauseFirstAppearance}>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <AutofixRootCauseDisplay {...props} />
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const Description = styled('div')`
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding-bottom: ${space(2)};
  margin-bottom: ${space(2)};
`;

const NoCausesPadding = styled('div')`
  padding: 0 ${space(2)};
`;

const CausesContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding: ${p => p.theme.space.lg};
  background: ${p => p.theme.tokens.background.primary};
`;

const Content = styled('div')`
  padding: ${space(1)} 0;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
  flex-wrap: wrap;
`;

const HeaderText = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CustomRootCausePadding = styled('div')`
  padding: ${space(1)} ${space(0.25)} ${space(2)} ${space(0.25)};
`;

const CauseDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  margin-top: ${space(0.5)};
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

const BottomDivider = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const BottomButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${space(1)};
  padding-top: ${p => p.theme.space.xl};
`;

const SolutionInput = styled(TextArea)`
  flex: 1;
  resize: none;
  margin-right: ${p => p.theme.space.lg};
  margin-left: ${p => p.theme.space['3xl']};
  max-width: 250px;
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;
  border-left: none;
`;

const SmallIntegrationIdText = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

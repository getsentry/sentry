import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {
  AutofixChangesStep,
  AutofixData,
  AutofixRootCauseStep,
  AutofixSolutionStep,
} from 'sentry/components/events/autofix/types';
import {AutofixStoppingPoint} from 'sentry/components/events/autofix/types';
import {Hovercard} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconClose, IconOpen, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  PRStatusCellProps,
  RepoPRState,
  SeerStatusCellProps,
} from 'sentry/views/issuesWithSeer/types';

interface SeerWorkflowProps {
  codeChangesStatus: 'yes' | 'no' | 'in_progress' | 'error';
  groupId: string;
  prStatus: 'yes' | 'no' | 'in_progress' | 'error';
  rcaStatus: 'yes' | 'no' | 'in_progress' | 'error';
  solutionStatus: 'yes' | 'no' | 'in_progress' | 'error';
  prLinks?: string[];
  seerState?: AutofixData | null;
}

function getRCAHovercardContent(seerState?: AutofixData | null) {
  if (!seerState) {
    return null;
  }

  const rcaStep = seerState.steps?.find(
    step => step.key === 'root_cause_analysis'
  ) as AutofixRootCauseStep;

  if (!rcaStep?.causes?.length) {
    return null;
  }

  // Find the selected root cause
  let selectedCause = null;
  if (rcaStep.selection && 'cause_id' in rcaStep.selection) {
    const causeId = (rcaStep.selection as {cause_id: string}).cause_id;
    selectedCause = rcaStep.causes.find(cause => cause.id === causeId);
  }

  // If no selection or selection not found, show the first cause
  const causeToShow = selectedCause || rcaStep.causes[0];

  if (!causeToShow?.description) {
    return null;
  }

  return (
    <HovercardContent>
      <HovercardSection>
        <Text size="sm">{causeToShow.description}</Text>
      </HovercardSection>
    </HovercardContent>
  );
}

function getSolutionHovercardContent(seerState?: AutofixData | null) {
  if (!seerState) {
    return null;
  }

  const solutionStep = seerState.steps?.find(
    step => step.key === 'solution'
  ) as AutofixSolutionStep;

  if (!solutionStep?.solution?.length) {
    return null;
  }

  return (
    <HovercardContent>
      {solutionStep.solution.map((solution, idx) => (
        <HovercardSection key={idx}>
          <Text size="sm">{solution.title}</Text>
        </HovercardSection>
      ))}
    </HovercardContent>
  );
}

function getCodeChangesHovercardContent(seerState?: AutofixData | null) {
  if (!seerState) {
    return null;
  }

  const changesStep = seerState.steps?.find(
    step => step.key === 'changes'
  ) as AutofixChangesStep;

  if (!changesStep?.changes?.length) {
    return null;
  }

  return (
    <HovercardContent>
      {changesStep.changes.map((change, idx) => (
        <HovercardSection key={idx}>
          <Text size="sm">{change.title}</Text>
        </HovercardSection>
      ))}
    </HovercardContent>
  );
}

function getPRHovercardContent(seerState?: AutofixData | null, prLinks?: string[]) {
  if (!prLinks || prLinks.length === 0) {
    return null;
  }

  // Get PR info from the changes step
  const changesStep = seerState?.steps?.find(
    step => step.key === 'changes' || step.key === 'plan'
  ) as AutofixChangesStep;
  const prInfo = changesStep?.changes?.[0]?.pull_request;
  const latestProgress = changesStep?.progress?.[changesStep.progress.length - 1];

  return (
    <HovercardContent>
      {prInfo?.pr_number && (
        <HovercardSection>
          <HovercardLabel>{t('Pull Request')}</HovercardLabel>
          <Text size="sm">
            <ExternalLink href={prLinks[0]}>#{prInfo.pr_number}</ExternalLink>
          </Text>
        </HovercardSection>
      )}
      {latestProgress && (
        <HovercardSection>
          <HovercardLabel>{t('Latest Update')}</HovercardLabel>
          <Text size="sm">{latestProgress.message}</Text>
        </HovercardSection>
      )}
      {!prInfo?.pr_number && (
        <HovercardSection>
          <HovercardLabel>{t('Pull Request')}</HovercardLabel>
          <Text size="sm">
            <ExternalLink href={prLinks[0]}>{t('View PR')}</ExternalLink>
          </Text>
        </HovercardSection>
      )}
    </HovercardContent>
  );
}

export function SeerWorkflowCell({
  rcaStatus,
  solutionStatus,
  codeChangesStatus,
  prStatus,
  seerState,
  prLinks,
  groupId,
}: SeerWorkflowProps) {
  const api = useApi();
  const organization = useOrganization();

  const triggerAutofix = useCallback(
    async (stoppingPoint: AutofixStoppingPoint) => {
      try {
        await api.requestPromise(
          `/organizations/${organization.slug}/issues/${groupId}/autofix/`,
          {
            method: 'POST',
            data: {
              instruction: '',
              stopping_point: stoppingPoint,
            },
          }
        );
        // Refresh the page to show the new status
        window.location.reload();
      } catch (error) {
        addErrorMessage(t('Failed to trigger autofix'));
      }
    },
    [api, organization.slug, groupId]
  );

  const getStatusColor = (status: 'yes' | 'no' | 'in_progress' | 'error') => {
    if (status === 'yes') return 'success';
    if (status === 'in_progress') return 'info';
    if (status === 'error') return 'danger';
    return 'muted';
  };

  const renderStepIcon = (status: 'yes' | 'no' | 'in_progress' | 'error') => {
    if (status === 'yes') return <IconCheckmark size="xs" />;
    if (status === 'in_progress') return <LoadingIndicator mini size={12} />;
    if (status === 'error') return <IconWarning size="xs" />;
    return <IconClose size="xs" />;
  };

  const rcaContent = getRCAHovercardContent(seerState);
  const solutionContent = getSolutionHovercardContent(seerState);
  const codeChangesContent = getCodeChangesHovercardContent(seerState);
  const prContent = getPRHovercardContent(seerState, prLinks);

  const renderStep = (
    status: 'yes' | 'no' | 'in_progress' | 'error',
    label: string,
    content: React.ReactNode,
    header: string,
    stoppingPoint: AutofixStoppingPoint
  ) => {
    const stepContent = (
      <StepIndicator status={getStatusColor(status)}>
        {renderStepIcon(status)}
      </StepIndicator>
    );

    // If status is 'no' and there's no content, render as a button
    if (status === 'no' && !content) {
      return (
        <StepButton
          onClick={() => triggerAutofix(stoppingPoint)}
          title={t('Click to trigger %s', label)}
        >
          {stepContent}
        </StepButton>
      );
    }

    // Otherwise, render with hovercard
    return (
      <Hovercard body={content} header={header} displayTimeout={200} skipWrapper>
        <StepWrapper>{stepContent}</StepWrapper>
      </Hovercard>
    );
  };

  return (
    <WorkflowContainer>
      {renderStep(
        rcaStatus,
        t('Root Cause'),
        rcaContent,
        t('Root Cause Analysis'),
        AutofixStoppingPoint.ROOT_CAUSE
      )}

      <Connector active={rcaStatus === 'yes' || solutionStatus !== 'no'} />

      {renderStep(
        solutionStatus,
        t('Solution'),
        solutionContent,
        t('Solution'),
        AutofixStoppingPoint.SOLUTION
      )}

      <Connector active={solutionStatus === 'yes' || codeChangesStatus !== 'no'} />

      {renderStep(
        codeChangesStatus,
        t('Code Changes'),
        codeChangesContent,
        t('Code Changes'),
        AutofixStoppingPoint.CODE_CHANGES
      )}

      <Connector active={codeChangesStatus === 'yes' || prStatus !== 'no'} />

      {/* PR step - special handling for clickable link vs button */}
      {prStatus === 'no' && !prContent ? (
        <StepButton
          onClick={() => triggerAutofix(AutofixStoppingPoint.OPEN_PR)}
          title={t('Click to trigger PR creation')}
        >
          <StepIndicator status={getStatusColor(prStatus)}>
            {renderStepIcon(prStatus)}
          </StepIndicator>
        </StepButton>
      ) : (
        <Hovercard
          body={prContent}
          header={t('Pull Request')}
          displayTimeout={200}
          skipWrapper
        >
          {prLinks && prLinks.length > 0 ? (
            <PRLinkWrapper href={prLinks[0]}>
              <StepIndicator status={getStatusColor(prStatus)}>
                {renderStepIcon(prStatus)}
              </StepIndicator>
            </PRLinkWrapper>
          ) : (
            <StepWrapper>
              <StepIndicator status={getStatusColor(prStatus)}>
                {renderStepIcon(prStatus)}
              </StepIndicator>
            </StepWrapper>
          )}
        </Hovercard>
      )}
    </WorkflowContainer>
  );
}

export function SeerStatusCell({status}: SeerStatusCellProps) {
  if (status === 'yes') {
    return (
      <Flex align="center" gap="sm">
        <IconCheckmark variant="success" size="sm" />
        <Text size="sm">{t('Yes')}</Text>
      </Flex>
    );
  }

  if (status === 'in_progress') {
    return (
      <Flex align="center" gap="sm">
        <LoadingIndicator mini />
        <Text size="sm">{t('In Progress')}</Text>
      </Flex>
    );
  }

  if (status === 'error') {
    return (
      <Flex align="center" gap="sm">
        <IconWarning variant="danger" size="sm" />
        <Text size="sm">{t('Error')}</Text>
      </Flex>
    );
  }

  return (
    <Flex align="center" gap="sm">
      <IconClose size="sm" />
      <Text size="sm" variant="muted">
        {t('No')}
      </Text>
    </Flex>
  );
}

export function PRStatusCell({prLinks}: PRStatusCellProps) {
  if (!prLinks || prLinks.length === 0) {
    return (
      <Flex align="center" gap="sm">
        <IconClose size="sm" />
        <Text size="sm" variant="muted">
          {t('No PR')}
        </Text>
      </Flex>
    );
  }

  const prCount = prLinks.length;
  const firstPRUrl = prLinks[0];

  return (
    <Flex align="center" gap="sm">
      <IconCheckmark variant="success" size="sm" />
      <ExternalLink href={firstPRUrl}>
        {prCount === 1 ? t('View PR') : t('View PRs (%s)', prCount)}
      </ExternalLink>
    </Flex>
  );
}

interface MergeStatusCellProps {
  prStates?: Record<string, RepoPRState>;
}

interface PRCombinedStatusCellProps {
  seerState?: AutofixData | null;
}

export function PRCombinedStatusCell({seerState}: PRCombinedStatusCellProps) {
  // Get PR info from the changes step
  const changesStep = seerState?.steps?.find(
    step => step.key === 'changes' || step.key === 'plan'
  ) as AutofixChangesStep;
  const prInfo = changesStep?.changes?.[0]?.pull_request;

  if (!prInfo?.pr_url) {
    return (
      <Text size="sm" variant="muted">
        {t('N/A')}
      </Text>
    );
  }

  return (
    <ExternalLink href={prInfo.pr_url}>
      {prInfo.pr_number ? t('PR #%s', prInfo.pr_number) : t('View PR')}
    </ExternalLink>
  );
}

export function MergeStatusCell({prStates}: MergeStatusCellProps) {
  if (!prStates || Object.keys(prStates).length === 0) {
    return (
      <Text size="sm" variant="muted">
        {t('N/A')}
      </Text>
    );
  }

  const states = Object.values(prStates);
  const firstState = states[0];

  if (!firstState?.status) {
    return (
      <Text size="sm" variant="muted">
        {t('Unknown')}
      </Text>
    );
  }

  if (firstState.status === 'merged') {
    return (
      <Flex align="center" gap="sm">
        <IconCheckmark variant="success" size="sm" />
        <Text size="sm">{t('Merged')}</Text>
      </Flex>
    );
  }

  if (firstState.status === 'closed') {
    return (
      <Flex align="center" gap="sm">
        <IconClose size="sm" />
        <Text size="sm">{t('Closed')}</Text>
      </Flex>
    );
  }

  return (
    <Flex align="center" gap="sm">
      <IconOpen size="sm" />
      <Text size="sm">{t('Open')}</Text>
    </Flex>
  );
}

interface CommentCountCellProps {
  botComments: number;
  humanComments: number;
}

export function CommentCountCell({botComments, humanComments}: CommentCountCellProps) {
  return (
    <Flex direction="column" gap="xs">
      <Text size="sm">{t('Bot: %s', botComments)}</Text>
      <Text size="sm" variant="muted">
        {t('Human: %s', humanComments)}
      </Text>
    </Flex>
  );
}

const WorkflowContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: 100%;
`;

const StepWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

const StepButton = styled(Button)`
  flex: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    transform: translateY(-2px);
    transition: transform 0.1s ease-in-out;
  }
`;

interface StepIndicatorProps {
  status: 'success' | 'info' | 'danger' | 'muted';
}

const StepIndicator = styled('div')<StepIndicatorProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${p => {
    switch (p.status) {
      case 'success':
        return p.theme.tokens.background.success;
      case 'info':
        return p.theme.tokens.background.accent;
      case 'danger':
        return p.theme.tokens.background.danger;
      default:
        return p.theme.tokens.background.secondary;
    }
  }};
  border: 2px solid
    ${p => {
      switch (p.status) {
        case 'success':
          return p.theme.tokens.border.success;
        case 'info':
          return p.theme.tokens.border.accent;
        case 'danger':
          return p.theme.tokens.border.danger;
        default:
          return p.theme.tokens.border.primary;
      }
    }};
  color: ${p => {
    switch (p.status) {
      case 'success':
        return p.theme.tokens.content.success;
      case 'info':
        return p.theme.tokens.content.accent;
      case 'danger':
        return p.theme.tokens.content.danger;
      default:
        return p.theme.tokens.content.muted;
    }
  }};
`;

interface ConnectorProps {
  active: boolean;
}

const Connector = styled('div')<ConnectorProps>`
  height: 3px;
  width: 28px;
  background: ${p =>
    p.active
      ? `linear-gradient(to right, ${p.theme.tokens.border.success}, ${p.theme.tokens.border.success})`
      : p.theme.tokens.border.secondary};
  position: relative;
  border-radius: 2px;
  transition: all 0.2s ease-in-out;

  &::before {
    content: '';
    position: absolute;
    right: -2px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 7px solid
      ${p => (p.active ? p.theme.tokens.border.success : p.theme.tokens.border.secondary)};
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    transition: border-color 0.2s ease-in-out;
  }
`;

const HovercardContent = styled('div')`
  min-width: 280px;
  max-width: 400px;
`;

const HovercardSection = styled('div')`
  padding: ${space(1.5)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const HovercardLabel = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  text-transform: uppercase;
  margin-bottom: ${space(0.5)};
`;

const PRLinkWrapper = styled(ExternalLink)`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-decoration: none;

  &:hover {
    transform: translateY(-2px);
    transition: transform 0.1s ease-in-out;
  }
`;

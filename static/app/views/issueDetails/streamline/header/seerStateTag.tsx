import {useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';

import {
  getOrderedAutofixSections,
  isCodeChangesSection,
  isPullRequestsSection,
  isRootCauseSection,
  isSolutionSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

interface SeerStateTagProps {
  group: Group;
  project: Project;
}

export function SeerStateTag({group, project}: SeerStateTagProps) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, project);
  const isExplorer = organization.features.includes('autofix-on-explorer');
  const issueTypeConfig = getConfigForIssueType(group, project);
  const issueTypeSupportsSeer = issueTypeConfig.autofix || issueTypeConfig.issueSummary;

  const autofix = useExplorerAutofix(group.id, {
    enabled: aiConfig.areAiFeaturesAllowed && isExplorer,
  });

  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );

  if (
    !aiConfig.areAiFeaturesAllowed ||
    !isExplorer ||
    !issueTypeSupportsSeer ||
    !autofix.runState
  ) {
    return null;
  }

  const completedRootCause = sections.some(
    s => isRootCauseSection(s) && s.status === 'completed'
  );
  const completedSolution = sections.some(
    s => isSolutionSection(s) && s.status === 'completed'
  );
  const completedCodeChanges = sections.some(
    s => isCodeChangesSection(s) && s.status === 'completed'
  );
  const hasPR = sections.some(isPullRequestsSection);

  let stateLabel: string;
  if (hasPR) {
    stateLabel = t('PR Opened');
  } else if (completedCodeChanges) {
    stateLabel = t('Code Changes Ready');
  } else if (completedSolution) {
    stateLabel = t('Solution Generated');
  } else if (completedRootCause) {
    stateLabel = t('Root Cause Found');
  } else {
    return null;
  }

  return (
    <Tag icon={<IconSeer size="xs" />} variant="info">
      {stateLabel}
    </Tag>
  );
}

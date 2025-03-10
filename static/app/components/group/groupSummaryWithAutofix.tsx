import React, {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {
  type AutofixChangesStep,
  type AutofixCodebaseChange,
  type AutofixData,
  AutofixStatus,
} from 'sentry/components/events/autofix/types';
import {AutofixStepType} from 'sentry/components/events/autofix/types';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import Placeholder from 'sentry/components/placeholder';
import {IconCode, IconFix, IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import marked from 'sentry/utils/marked';
import testableTransition from 'sentry/utils/testableTransition';
import {useOpenSolutionsDrawer} from 'sentry/views/issueDetails/streamline/sidebar/solutionsHubDrawer';

const pulseAnimation = {
  initial: {opacity: 1},
  animate: {
    opacity: 0.6,
    transition: testableTransition({
      repeat: Infinity,
      repeatType: 'reverse',
      duration: 1,
    }),
  },
};

interface InsightCardObject {
  id: string;
  insight: string | null | undefined;
  title: string;
  icon?: React.ReactNode;
  insightElement?: React.ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
}

const getRootCauseDescription = (autofixData: AutofixData) => {
  const rootCause = autofixData.steps?.find(
    step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
  );
  if (!rootCause) {
    return null;
  }
  return rootCause.causes.at(0)?.description ?? null;
};

const getSolutionDescription = (autofixData: AutofixData) => {
  const solution = autofixData.steps?.find(
    step => step.type === AutofixStepType.SOLUTION
  );
  if (!solution) {
    return null;
  }

  return solution.description ?? null;
};

const getSolutionIsLoading = (autofixData: AutofixData) => {
  const solutionProgressStep = autofixData.steps?.find(
    step => step.key === 'solution_processing'
  );
  return solutionProgressStep?.status === AutofixStatus.PROCESSING;
};

const getCodeChangesDescription = (autofixData: AutofixData) => {
  if (!autofixData) {
    return null;
  }

  const changesStep = autofixData.steps?.find(
    step => step.type === AutofixStepType.CHANGES
  ) as AutofixChangesStep | undefined;

  if (!changesStep) {
    return null;
  }

  // If there are changes with PRs, show links to them
  const changesWithPRs = changesStep.changes?.filter(
    (change: AutofixCodebaseChange) => change.pull_request
  );
  if (changesWithPRs?.length) {
    return changesWithPRs
      .map(
        (change: AutofixCodebaseChange) =>
          `[View PR in ${change.repo_name}](${change.pull_request?.pr_url})`
      )
      .join('\n');
  }

  // If there are code changes but no PRs yet, show a summary
  if (changesStep.changes?.length) {
    // Group changes by repo
    const changesByRepo: Record<string, number> = {};
    changesStep.changes.forEach((change: AutofixCodebaseChange) => {
      changesByRepo[change.repo_name] = (changesByRepo[change.repo_name] || 0) + 1;
    });

    const changesSummary = Object.entries(changesByRepo)
      .map(([repo, count]) => `${count} ${count === 1 ? 'change' : 'changes'} in ${repo}`)
      .join(', ');

    return `Proposed ${changesSummary}.`;
  }

  return null;
};

const getCodeChangesIsLoading = (autofixData: AutofixData) => {
  if (!autofixData) {
    return false;
  }

  // Check if there's a specific changes processing step, similar to solution_processing
  const changesProgressStep = autofixData.steps?.find(step => step.key === 'plan');
  if (changesProgressStep?.status === AutofixStatus.PROCESSING) {
    return true;
  }

  // Also check if the changes step itself is in processing state
  const changesStep = autofixData.steps?.find(
    step => step.type === AutofixStepType.CHANGES
  );

  return changesStep?.status === AutofixStatus.PROCESSING;
};

export function GroupSummaryWithAutofix({
  group,
  event,
  project,
  preview = false,
}: {
  event: Event | undefined;
  group: Group;
  project: Project;
  preview?: boolean;
}) {
  const {data: autofixData, isPending} = useAutofixData({groupId: group.id});

  const openSolutionsDrawer = useOpenSolutionsDrawer(group, project, event);

  const rootCauseDescription = useMemo(
    () => (autofixData ? getRootCauseDescription(autofixData) : null),
    [autofixData]
  );

  const solutionDescription = useMemo(
    () => (autofixData ? getSolutionDescription(autofixData) : null),
    [autofixData]
  );

  const solutionIsLoading = useMemo(
    () => (autofixData ? getSolutionIsLoading(autofixData) : false),
    [autofixData]
  );

  const codeChangesDescription = useMemo(
    () => (autofixData ? getCodeChangesDescription(autofixData) : null),
    [autofixData]
  );

  const codeChangesIsLoading = useMemo(
    () => (autofixData ? getCodeChangesIsLoading(autofixData) : false),
    [autofixData]
  );

  if (isPending) {
    return <Placeholder height="130px" />;
  }

  if (rootCauseDescription) {
    return (
      <AutofixSummary
        rootCauseDescription={rootCauseDescription}
        solutionDescription={solutionDescription}
        solutionIsLoading={solutionIsLoading}
        codeChangesDescription={codeChangesDescription}
        codeChangesIsLoading={codeChangesIsLoading}
        openSolutionsDrawer={openSolutionsDrawer}
      />
    );
  }

  return <GroupSummary group={group} event={event} project={project} preview={preview} />;
}

function AutofixSummary({
  rootCauseDescription,
  solutionDescription,
  solutionIsLoading,
  codeChangesDescription,
  codeChangesIsLoading,
  openSolutionsDrawer,
}: {
  codeChangesDescription: string | null;
  codeChangesIsLoading: boolean;
  openSolutionsDrawer: () => void;
  rootCauseDescription: string | null;
  solutionDescription: string | null;
  solutionIsLoading: boolean;
}) {
  const insightCards: InsightCardObject[] = [
    {
      id: 'root_cause_description',
      title: t('Root Cause'),
      insight: rootCauseDescription,
      icon: <IconFocus size="sm" color="pink400" />,
      onClick: openSolutionsDrawer,
    },

    ...(solutionDescription || solutionIsLoading
      ? [
          {
            id: 'solution_description',
            title: t('Solution'),
            insight: solutionDescription,
            icon: <IconFix size="sm" color="green400" />,
            isLoading: solutionIsLoading,
            onClick: openSolutionsDrawer,
          },
        ]
      : []),

    ...(codeChangesDescription || codeChangesIsLoading
      ? [
          {
            id: 'code_changes',
            title: t('Code Changes'),
            insight: codeChangesDescription,
            icon: <IconCode size="sm" color="blue400" />,
            isLoading: codeChangesIsLoading,
            onClick: openSolutionsDrawer,
          },
        ]
      : []),
  ];

  // Add event listener to prevent propagation of click events from links
  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isLink = target.tagName === 'A' || target.closest('a');

      if (isLink) {
        event.stopPropagation();
      }
    };
    document.addEventListener('click', handleLinkClick, true);
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, []);

  return (
    <div data-testid="autofix-summary">
      <Content>
        <InsightGrid>
          {insightCards.map(card => {
            if (!card.isLoading && !card.insight) {
              return null;
            }

            return (
              <InsightCardButton
                key={card.id}
                onClick={card.onClick}
                initial="initial"
                animate={card.isLoading ? 'animate' : 'initial'}
                variants={pulseAnimation}
              >
                <InsightCard>
                  <CardTitle preview={card.isLoading}>
                    <CardTitleIcon>{card.icon}</CardTitleIcon>
                    <CardTitleText>{card.title}</CardTitleText>
                  </CardTitle>
                  <CardContent>
                    {card.isLoading ? (
                      <Placeholder height="1.5rem" />
                    ) : (
                      <React.Fragment>
                        {card.insightElement}
                        {card.insight && (
                          <div
                            onClick={e => {
                              // Stop propagation if the click is directly on a link
                              if ((e.target as HTMLElement).tagName === 'A') {
                                e.stopPropagation();
                              }
                            }}
                            dangerouslySetInnerHTML={{
                              __html: marked(
                                card.isLoading
                                  ? card.insight.replace(/\*\*/g, '')
                                  : card.insight
                              ),
                            }}
                          />
                        )}
                      </React.Fragment>
                    )}
                  </CardContent>
                </InsightCard>
              </InsightCardButton>
            );
          })}
        </InsightGrid>
      </Content>
    </div>
  );
}

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  position: relative;
`;

const InsightGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
`;

const InsightCardButton = styled(motion.button)`
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  width: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  box-shadow: ${p => p.theme.dropShadowLight};
  background-color: ${p => p.theme.background};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:active {
    opacity: 0.8;
  }
`;

const InsightCard = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
`;

const CardTitle = styled('div')<{preview?: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const CardTitleText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const CardContent = styled('div')`
  overflow-wrap: break-word;
  word-break: break-word;
  padding: ${space(1.5)};
  text-align: left;
  flex: 1;

  p {
    margin: 0;
    white-space: pre-wrap;
  }

  code {
    word-break: break-all;
  }

  a {
    color: ${p => p.theme.linkColor};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

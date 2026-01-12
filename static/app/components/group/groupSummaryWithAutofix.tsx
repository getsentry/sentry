import React, {useMemo} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Flex, Stack} from '@sentry/scraps/layout';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {AutofixStepFeedback} from 'sentry/components/events/autofix/autofixStepFeedback';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {
  getAutofixRunExists,
  getCodeChangesDescription,
  getCodeChangesIsLoading,
  getRootCauseCopyText,
  getRootCauseDescription,
  getSolutionCopyText,
  getSolutionDescription,
  getSolutionIsLoading,
  hasPullRequest,
} from 'sentry/components/events/autofix/utils';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import Placeholder from 'sentry/components/placeholder';
import {IconCode, IconFix, IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MarkedText} from 'sentry/utils/marked/markedText';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import testableTransition from 'sentry/utils/testableTransition';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

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
  copyAnalyticsEventKey?: string;
  copyAnalyticsEventName?: string;
  copyText?: string | null;
  copyTitle?: string | null;
  feedbackType?: 'root_cause' | 'solution' | 'changes';
  icon?: React.ReactNode;
  insightElement?: React.ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
}

export function GroupSummaryWithAutofix({
  group,
  event,
  project,
  preview = false,
}: {
  event: Event;
  group: Group;
  project: Project;
  preview?: boolean;
}) {
  const {data: autofixData, isPending} = useAutofixData({groupId: group.id});

  const rootCauseDescription = useMemo(
    () => (autofixData ? getRootCauseDescription(autofixData) : null),
    [autofixData]
  );

  const rootCauseCopyText = useMemo(
    () => (autofixData ? getRootCauseCopyText(autofixData) : null),
    [autofixData]
  );

  const solutionDescription = useMemo(
    () => (autofixData ? getSolutionDescription(autofixData) : null),
    [autofixData]
  );

  const solutionCopyText = useMemo(
    () => (autofixData ? getSolutionCopyText(autofixData) : null),
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

  // Track autofix features analytics
  useRouteAnalyticsParams({
    has_root_cause: Boolean(rootCauseDescription),
    has_solution: Boolean(solutionDescription),
    has_coded_solution: Boolean(codeChangesDescription),
    has_pr: hasPullRequest(autofixData),
  });

  if (isPending && getAutofixRunExists(group)) {
    return <Placeholder height="130px" />;
  }

  if (rootCauseDescription) {
    return (
      <AutofixSummary
        group={group}
        rootCauseDescription={rootCauseDescription}
        solutionDescription={solutionDescription}
        solutionIsLoading={solutionIsLoading}
        codeChangesDescription={codeChangesDescription}
        codeChangesIsLoading={codeChangesIsLoading}
        rootCauseCopyText={rootCauseCopyText}
        solutionCopyText={solutionCopyText}
      />
    );
  }

  return <GroupSummary group={group} event={event} project={project} preview={preview} />;
}

export function AutofixSummary({
  group,
  rootCauseDescription,
  solutionDescription,
  solutionIsLoading,
  codeChangesDescription,
  codeChangesIsLoading,
  rootCauseCopyText,
  solutionCopyText,
}: {
  codeChangesDescription: string | null;
  codeChangesIsLoading: boolean;
  group: Group;
  rootCauseCopyText: string | null;
  rootCauseDescription: string | null;
  solutionCopyText: string | null;
  solutionDescription: string | null;
  solutionIsLoading: boolean;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {data: autofixData} = useAutofixData({groupId: group.id});

  const seerLink = {
    pathname: location.pathname,
    query: {
      ...location.query,
      seerDrawer: true,
    },
  };

  const insightCards: InsightCardObject[] = [
    {
      id: 'root_cause_description',
      title: t('Root Cause'),
      insight: rootCauseDescription,
      icon: <IconFocus size="sm" />,
      feedbackType: 'root_cause',
      onClick: () => {
        trackAnalytics('autofix.summary_root_cause_clicked', {
          organization,
          group_id: group.id,
        });
        navigate({
          ...seerLink,
          query: {
            ...seerLink.query,
            scrollTo: 'root_cause',
          },
        });
      },
      copyTitle: t('Copy root cause as Markdown'),
      copyText: rootCauseCopyText,
      copyAnalyticsEventName: 'Autofix: Copy Root Cause as Markdown',
      copyAnalyticsEventKey: 'autofix.root_cause.copy',
    },

    ...(solutionDescription || solutionIsLoading
      ? [
          {
            id: 'solution_description',
            title: t('Solution'),
            insight: solutionDescription,
            icon: <IconFix size="sm" />,
            isLoading: solutionIsLoading,
            feedbackType: 'solution' as const,
            onClick: () => {
              trackAnalytics('autofix.summary_solution_clicked', {
                organization,
                group_id: group.id,
              });
              navigate({
                ...seerLink,
                query: {
                  ...seerLink.query,
                  scrollTo: 'solution',
                },
              });
            },
            copyTitle: t('Copy solution as Markdown'),
            copyText: solutionCopyText,
            copyAnalyticsEventName: 'Autofix: Copy Solution as Markdown',
            copyAnalyticsEventKey: 'autofix.solution.copy',
          },
        ]
      : []),

    ...(codeChangesDescription || codeChangesIsLoading
      ? [
          {
            id: 'code_changes',
            title: t('Code Changes'),
            insight: codeChangesDescription,
            icon: <IconCode size="sm" />,
            isLoading: codeChangesIsLoading,
            feedbackType: 'changes' as const,
            onClick: () => {
              trackAnalytics('autofix.summary_code_changes_clicked', {
                organization,
                group_id: group.id,
              });
              navigate({
                ...seerLink,
                query: {
                  ...seerLink.query,
                  scrollTo: 'code_changes',
                },
              });
            },
          },
        ]
      : []),
  ];

  return (
    <div data-testid="autofix-summary">
      <Stack gap="md" position="relative">
        <InsightGrid>
          {insightCards.map(card => {
            if (!card.isLoading && !card.insight) {
              return null;
            }

            return (
              <InsightCardButton key={card.id} onClick={card.onClick} role="button">
                <Stack width="100%" overflow="hidden">
                  <CardTitle preview={card.isLoading}>
                    <Flex align="center" gap="sm">
                      <CardTitleIcon>{card.icon}</CardTitleIcon>
                      <CardTitleText>{card.title}</CardTitleText>
                    </Flex>
                    <Flex align="center" gap="xs">
                      {!card.isLoading && card.feedbackType && autofixData?.run_id && (
                        <AutofixStepFeedback
                          stepType={card.feedbackType}
                          groupId={group.id}
                          runId={autofixData.run_id}
                          buttonSize="zero"
                          compact
                          onFeedbackClick={e => e.stopPropagation()}
                        />
                      )}
                      {card.copyText && card.copyTitle && (
                        <CopyToClipboardButton
                          aria-label={t('Copy to clipboard')}
                          size="xs"
                          text={card.copyText}
                          borderless
                          title={card.copyTitle}
                          onClick={e => {
                            e.stopPropagation();
                          }}
                          analyticsEventName={card.copyAnalyticsEventName}
                          analyticsEventKey={card.copyAnalyticsEventKey}
                        />
                      )}
                    </Flex>
                  </CardTitle>
                  <CardContent>
                    {card.isLoading ? (
                      <motion.div
                        initial="initial"
                        animate="animate"
                        variants={pulseAnimation}
                      >
                        <Placeholder height="1.5rem" />
                      </motion.div>
                    ) : (
                      <React.Fragment>
                        {card.insightElement}
                        {card.insight && (
                          <MarkedText
                            onClick={e => {
                              // Stop propagation if the click is directly on a link
                              if ((e.target as HTMLElement).tagName === 'A') {
                                e.stopPropagation();
                              }
                            }}
                            text={
                              card.isLoading
                                ? card.insight.replace(/\*\*/g, '')
                                : card.insight
                            }
                          />
                        )}
                      </React.Fragment>
                    )}
                  </CardContent>
                </Stack>
              </InsightCardButton>
            );
          })}
        </InsightGrid>
      </Stack>
    </div>
  );
}

const InsightCardButton = styled(motion.div)`
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  width: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  box-shadow: ${p => p.theme.dropShadowLight};
  background-color: ${p => p.theme.tokens.background.primary};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:active {
    opacity: 0.8;
  }
`;

const InsightGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  position: relative;

  &:before {
    content: '';
    position: absolute;
    left: ${space(3)};
    top: ${space(4)};
    bottom: ${space(2)};
    width: 1px;
    background: ${p => p.theme.tokens.border.primary};
    z-index: 0;
  }
`;

const CardTitle = styled('div')<{preview?: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.tokens.content.primary};
  padding: ${space(0.5)} ${space(0.5)} 0 ${space(1)};
  justify-content: space-between;
`;

const CardTitleText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-top: 1px;
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.primary};
`;

const CardContent = styled('div')`
  overflow-wrap: break-word;
  word-break: break-word;
  padding: ${space(0.5)} ${space(1)} ${space(1)} ${space(1)};
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
    color: ${p => p.theme.tokens.interactive.link.accent.rest};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

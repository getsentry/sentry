import {Fragment, useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {IconBug, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {CodeChanges} from './codeChanges';
import {
  LevelBar,
  OverviewAction,
  OverviewIssueTitle,
  PriorityAndAssignee,
  selectReviewPullRequest,
} from './overviewShared';
import {PullRequestFiles} from './pullRequestFiles';
import type {AutofixStateKey, OverviewRun, ProjectConfig} from './types';
import {useIsInView} from './useIsInView';

const NARRATIVE_MARKDOWN_COMPONENTS: MarkdownProps['components'] = {
  Paragraph: ({children}) => (
    <Text
      as="p"
      size="sm"
      variant="secondary"
      bold={false}
      tabular
      wordBreak="break-word"
    >
      {children}
    </Text>
  ),
};

function NarrativeBlock({
  icon,
  label,
  children,
}: {
  children: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Stack gap="xs">
      <Flex gap="xs" align="center">
        {icon}
        <Text size="xs" bold variant="secondary">
          {label}
        </Text>
      </Flex>
      <Markdown raw={children} components={NARRATIVE_MARKDOWN_COMPONENTS} />
    </Stack>
  );
}

export function OverviewCard({
  orgSlug,
  run,
  sectionKey,
  statsPeriod,
  scmSettled,
  vitalsPending,
  requestScmWindow,
  scmWindows,
  projectConfig,
  memberList,
  assigneeReady,
}: {
  assigneeReady: boolean;
  orgSlug: string;
  projectConfig: ProjectConfig | undefined;
  requestScmWindow: (runIds: string[]) => void;
  run: OverviewRun;
  scmSettled: boolean;
  scmWindows: string[][] | undefined;
  sectionKey: AutofixStateKey;
  statsPeriod: string | null;
  vitalsPending: boolean;
  memberList?: User[];
}) {
  const organization = useOrganization();
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useIsInView(cardRef);
  useEffect(() => {
    if (inView && scmWindows) {
      for (const window of scmWindows) {
        requestScmWindow(window);
      }
    }
  }, [inView, scmWindows, requestScmWindow]);
  const rootCause = run.rootCause?.oneLineDescription;
  const proposedFix = run.proposedFix?.oneLineSummary;
  const issueUrl = `/organizations/${orgSlug}/issues/${run.groupId}/`;
  const reviewPullRequest =
    sectionKey === 'review_pr' ? selectReviewPullRequest(run.pullRequests) : undefined;
  const changedFiles = reviewPullRequest?.files ?? [];
  const hasEnrichment = Boolean(
    reviewPullRequest?.checksStatus ||
    reviewPullRequest?.reviewStatus ||
    reviewPullRequest?.files?.length
  );
  const enrichmentPending =
    Boolean(reviewPullRequest?.url) && !hasEnrichment && !scmSettled;
  const trackCodeChangesExpanded = () =>
    trackAnalytics('autofix.overview.code_changes_expanded', {
      organization,
      group_id: run.groupId,
      run_id: run.seerRunId,
      section: sectionKey,
    });

  const showCodeChanges = Boolean(
    sectionKey === 'code_changes_ready' && run.codeChanges?.length
  );
  const showEnrichmentPlaceholder = enrichmentPending && Boolean(reviewPullRequest?.url);
  const showPullRequestFiles =
    !showEnrichmentPlaceholder && Boolean(reviewPullRequest) && changedFiles.length > 0;
  const hasBody = Boolean(
    rootCause ||
    proposedFix ||
    showCodeChanges ||
    showEnrichmentPlaceholder ||
    showPullRequestFiles
  );

  return (
    <CardFrame
      containerRef={cardRef}
      title={
        <OverviewIssueTitle
          run={run}
          orgSlug={orgSlug}
          sectionKey={sectionKey}
          statsPeriod={statsPeriod}
          vitalsPending={vitalsPending}
        />
      }
      meta={
        <PriorityAndAssignee
          run={run}
          memberList={memberList}
          assigneeReady={assigneeReady}
        />
      }
      actions={
        <OverviewAction
          sectionKey={sectionKey}
          run={run}
          reviewPullRequest={reviewPullRequest}
          issueUrl={issueUrl}
          projectConfig={projectConfig}
        />
      }
      body={
        hasBody ? (
          <Fragment>
            {rootCause && (
              <NarrativeBlock
                icon={<IconBug size="xs" variant="secondary" aria-hidden />}
                label={t('Root Cause')}
              >
                {rootCause}
              </NarrativeBlock>
            )}
            {proposedFix && (
              <NarrativeBlock
                icon={<IconCommit size="xs" variant="secondary" aria-hidden />}
                label={t('Plan')}
              >
                {proposedFix}
              </NarrativeBlock>
            )}
            {showCodeChanges && run.codeChanges ? (
              <CodeChanges
                codeChanges={run.codeChanges}
                onFirstExpand={trackCodeChangesExpanded}
              />
            ) : null}
            {showEnrichmentPlaceholder ? (
              <Placeholder height="3rem" />
            ) : showPullRequestFiles && reviewPullRequest ? (
              <PullRequestFiles
                orgSlug={orgSlug}
                pullRequest={reviewPullRequest}
                onFirstExpand={trackCodeChangesExpanded}
              />
            ) : null}
          </Fragment>
        ) : undefined
      }
    />
  );
}

function CardFrame({
  actions,
  body,
  meta,
  title,
  containerRef,
}: {
  actions: React.ReactNode;
  meta: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Container
      ref={containerRef}
      background="primary"
      border="primary"
      radius="md"
      padding="xl"
    >
      <Grid
        areas={{
          xs: body ? `"title" "meta" "body" "actions"` : `"title" "meta" "actions"`,
          sm: body ? `"title aside" "body aside"` : `"title aside"`,
        }}
        columns={{xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) max-content'}}
        rows={{xs: 'auto', sm: body ? 'auto 1fr' : 'auto'}}
        gap={{xs: 'lg', sm: 'lg 3xl'}}
      >
        <Container area="title" minWidth="0">
          {title}
        </Container>
        {body ? (
          <Stack area="body" gap="lg" minWidth="0">
            {body}
          </Stack>
        ) : null}
        <Aside gap="lg" align="end" justify="between">
          <Stack area="actions" align={{xs: 'start', sm: 'end'}}>
            {actions}
          </Stack>
          <Flex area="meta" align="center">
            {meta}
          </Flex>
        </Aside>
      </Grid>
    </Container>
  );
}

const Aside = styled(Stack)`
  grid-area: aside;

  @container (width < ${p => p.theme.container.sm}) {
    && {
      display: contents;
    }
  }
`;

export function TextLineSkeleton({
  size,
  width,
}: {
  size: 'xs' | 'sm' | 'md' | 'lg';
  width: string;
}) {
  return (
    <Text as="div" size={size}>
      <Placeholder height="1lh" width={width} />
    </Text>
  );
}

export function OverviewCardSkeleton() {
  const theme = useTheme();
  return (
    <CardFrame
      title={
        <Grid columns="max-content minmax(0, 1fr)" gap="sm">
          <LevelBar />
          <Stack minWidth="0" gap="xs">
            <TextLineSkeleton size="lg" width="70%" />
            <Flex wrap="wrap" gap="md" align="center">
              {['4.5rem', '4rem', '4rem', '5rem', '5rem'].map((width, index) => (
                <TextLineSkeleton key={index} size="sm" width={width} />
              ))}
            </Flex>
          </Stack>
        </Grid>
      }
      meta={
        <Flex gap="xs">
          <Placeholder height={theme.form.xs.height} width={theme.form.xs.height} />
          <Placeholder height={theme.form.xs.height} width={theme.form.xs.height} />
        </Flex>
      }
      actions={<Placeholder height={theme.form.sm.height} width="9rem" />}
      body={
        <Fragment>
          {['90%', '75%'].map((width, index) => (
            <Stack key={index} gap="xs">
              <TextLineSkeleton size="xs" width="4rem" />
              <TextLineSkeleton size="sm" width={width} />
            </Stack>
          ))}
          <Placeholder />
        </Fragment>
      }
    />
  );
}

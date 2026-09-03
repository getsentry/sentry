import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type MotionProps} from 'framer-motion';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ProjectList} from 'sentry/components/projectList';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconCircle,
  IconCircleCheckmark,
  IconCircleDashed,
  IconFatal,
  IconNot,
  IconPieHalf,
} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';

import {FirstIssueCard} from './firstIssueCard';
import type {AgenticProgressRun} from './types';

type AgenticProgressStageState = AgenticProgressRun['stages'][number];
type AgenticProgressStage = AgenticProgressStageState['stage'];
type AgenticProgressStageStatus = NonNullable<AgenticProgressStageState['status']>;

const STAGE_LABELS: Record<AgenticProgressStage, string> = {
  connect_mcp: t('Connect agent'),
  analyze_project: t('Analyzing your application'),
  create_project: t('Creating project(s)'),
  instrument_app: t('Instrumenting app'),
  plan_test_error: t('Plan test error'),
  send_verification_error: t('Send test error'),
  receive_verification_error: t('Confirm test error'),
  prepare_production: t('Prepare production'),
  check_stack_trace_quality: t('Check stack traces'),
};

const STATUS_LABELS: Record<AgenticProgressStageStatus, string> = {
  active: t('In progress'),
  waiting: t('Awaiting Input'),
  completed: t('Done'),
  skipped: t('Skipped'),
  bypassed: t('Bypassed'),
  failed: t('Failed'),
};

const STATUS_VARIANTS: Record<
  AgenticProgressStageStatus,
  'promotion' | 'warning' | 'success' | 'muted' | 'danger'
> = {
  active: 'promotion',
  waiting: 'warning',
  completed: 'success',
  skipped: 'muted',
  bypassed: 'muted',
  failed: 'danger',
};

function StageSymbol({status}: {status: AgenticProgressStageStatus | null}) {
  if (status === 'completed') {
    return <IconCircleCheckmark size="md" variant="success" />;
  }

  if (status === 'skipped') {
    return <IconNot size="md" variant="muted" />;
  }

  if (status === 'bypassed') {
    return <IconCircle size="md" variant="muted" />;
  }

  if (status === 'failed') {
    return <IconFatal size="md" variant="danger" />;
  }

  if (status === 'waiting') {
    return <IconPieHalf size="md" variant="warning" />;
  }

  if (status === 'active') {
    return <ActiveLoadingIndicator mini />;
  }

  return <IconCircleDashed size="md" variant="muted" />;
}

const ActiveLoadingIndicator = styled(LoadingIndicator)`
  && {
    width: 16px;
    height: 16px;
    margin: 0;
  }

  && .loading-indicator {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }
`;

const MotionGrid = motion.create(Grid);
const MotionStack = motion.create(Stack);

const STAGE_LIST_STAGGER_TRANSITION: MotionProps['transition'] = {
  staggerChildren: 0.03,
  delayChildren: 0.04,
};

const STAGE_ITEM_VARIANTS: MotionProps['variants'] = {
  initial: {opacity: 0, y: 12},
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      y: {type: 'spring', duration: 0.3, bounce: 0.35},
      opacity: {duration: 0.12, ease: 'easeOut'},
    },
  },
};
const MotionContainer = motion.create(Container);
const MotionTag = motion.create(Tag);
const MotionText = motion.create(Text);

// The negative margins counter ProgressItem's padding so the animated surface is
// full-bleed. Grid's tokenized margin props do not support negative spacing.
const MotionExtraContent = styled(MotionGrid)`
  min-height: 0;
  margin: 0 -${p => p.theme.space.lg} -${p => p.theme.space.lg};
`;

function ExtraContent({children}: {children: React.ReactNode}) {
  return (
    <MotionExtraContent
      initial={{height: 0}}
      animate={{height: 'auto'}}
      exit={{height: 0}}
      row="3"
      column="1 / -1"
      columns="subgrid"
      overflow="hidden"
    >
      <Grid
        column="1 / -1"
        columns="subgrid"
        marginTop="md"
        padding="md 0"
        background="secondary"
      >
        <Grid column="2 / 4" align="center">
          {children}
        </Grid>
      </Grid>
    </MotionExtraContent>
  );
}

function ProgressItem({
  extraContent,
  isLast,
  stage,
}: {
  isLast: boolean;
  stage: AgenticProgressStageState;
  extraContent?: React.ReactNode;
}) {
  const label = STAGE_LABELS[stage.stage];
  const variant =
    stage.status === 'active'
      ? 'primary'
      : stage.status
        ? STATUS_VARIANTS[stage.status]
        : 'muted';

  return (
    <MotionGrid
      variants={STAGE_ITEM_VARIANTS}
      columns="max-content minmax(0, 1fr) max-content"
      rows="auto auto auto"
      align="center"
      gap="0 md"
      padding="lg"
      borderBottom={isLast ? undefined : 'muted'}
    >
      <Grid row="1" column="1" align="center" justify="center" alignSelf="center">
        <AnimatePresence initial={false}>
          <MotionGrid
            key={stage.status ?? 'pending'}
            initial={{scale: 1.1, opacity: 0}}
            animate={{scale: 1, opacity: 1}}
            exit={{scale: 0.9, opacity: 0}}
            align="center"
            justify="center"
            alignSelf="center"
            justifySelf="center"
            style={{gridArea: '1 / 1'}}
          >
            <StageSymbol status={stage.status} />
          </MotionGrid>
        </AnimatePresence>
      </Grid>
      <Grid row="1" column="2" align="center">
        <Text bold variant={variant}>
          {label}
        </Text>
      </Grid>
      <Grid row="1" column="3" align="center" justifyItems="end">
        {stage.status ? null : (
          <Tag
            aria-hidden="true"
            variant="muted"
            style={{gridArea: '1 / 1', visibility: 'hidden'}}
          >
            placeholder
          </Tag>
        )}
        <AnimatePresence initial={false}>
          {stage.status ? (
            <MotionTag
              key={stage.status}
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 10}}
              style={{gridArea: '1 / 1', justifySelf: 'end'}}
              variant={STATUS_VARIANTS[stage.status]}
            >
              {STATUS_LABELS[stage.status]}
            </MotionTag>
          ) : null}
        </AnimatePresence>
      </Grid>
      <AnimatePresence initial={false}>
        {stage.eventNote ? (
          <MotionContainer
            key="note-container"
            initial={{height: 0}}
            animate={{height: 'auto'}}
            exit={{height: 0}}
            transition={{duration: 0.15}}
            row="2"
            column="2 / 4"
            overflow="hidden"
          >
            <Grid paddingTop="xs">
              <AnimatePresence initial={false}>
                <MotionText
                  key={stage.eventNote}
                  initial={{opacity: 0, y: -10}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: 10}}
                  style={{gridArea: '1 / 1'}}
                  align="left"
                  size="sm"
                  variant="muted"
                  density="comfortable"
                >
                  {stage.eventNote}
                </MotionText>
              </AnimatePresence>
            </Grid>
          </MotionContainer>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {extraContent ? (
          <ExtraContent key="extra-content">{extraContent}</ExtraContent>
        ) : null}
      </AnimatePresence>
    </MotionGrid>
  );
}

export function AgenticProgressList({
  extraContentByStage,
  header,
  stages,
}: {
  stages: AgenticProgressStageState[];
  extraContentByStage?: Partial<Record<AgenticProgressStage, React.ReactNode>>;
  header?: React.ReactNode;
}) {
  const [hasEntered, setHasEntered] = useState(false);
  useEffect(() => {
    setHasEntered(true);
  }, []);

  return (
    <MotionStack
      width="100%"
      border="primary"
      radius="lg"
      overflow="hidden"
      gap="0"
      initial="initial"
      animate={hasEntered ? 'animate' : 'initial'}
      transition={STAGE_LIST_STAGGER_TRANSITION}
    >
      {header ? (
        <Container padding="xl" borderBottom="muted">
          {header}
        </Container>
      ) : null}
      {stages.map((stage, index) => (
        <ProgressItem
          key={stage.stage}
          stage={stage}
          isLast={index === stages.length - 1}
          extraContent={extraContentByStage?.[stage.stage]}
        />
      ))}
    </MotionStack>
  );
}

function AgenticProgressMeta({
  isComplete,
  onboardingCode,
  updatedAt,
}: {
  isComplete: boolean;
  onboardingCode: string | undefined;
  updatedAt: string;
}) {
  if (isComplete && !onboardingCode) {
    return null;
  }

  return (
    <Flex align="center" justify={isComplete ? 'end' : 'between'} gap="md">
      {isComplete ? null : (
        <Flex align="center" gap="sm">
          <StatusIndicator variant="accent" />
          <Text size="sm" variant="muted">
            {tct('Last update [time]', {
              time: (
                <TimeSince
                  date={updatedAt}
                  disabledAbsoluteTooltip
                  liveUpdateInterval="second"
                />
              ),
            })}
          </Text>
        </Flex>
      )}
      {onboardingCode ? (
        <RunId size="sm" variant="muted" monospace>
          {t('ID:%s', onboardingCode)}
        </RunId>
      ) : null}
    </Flex>
  );
}

const RunId = styled(Text)`
  opacity: 0.6;
`;

/**
 * The finished run, collapsed. Nine rows all reading "Done" say no more than
 * one row does, so what survives the collapse is the outcome and what it
 * produced — the projects the agent created.
 */
function AgenticProgressSummary({projectSlugs}: {projectSlugs: string[]}) {
  const {projects} = useProjects({slugs: projectSlugs});
  // A single project is named outright; past that, the list's avatars and its
  // count carry it, since a row of full badges would not fit.
  const soleProjectSlug = projectSlugs.length === 1 ? projectSlugs[0] : undefined;
  const soleProject = soleProjectSlug
    ? (projects.find(project => project.slug === soleProjectSlug) ?? {
        slug: soleProjectSlug,
      })
    : undefined;

  return (
    <Flex
      width="100%"
      border="primary"
      radius="lg"
      padding="lg"
      gap="md"
      align="center"
      justify="between"
    >
      <Flex align="center" gap="md">
        <IconCircleCheckmark size="md" variant="success" />
        <Text bold>{t('Setup complete')}</Text>
      </Flex>
      {soleProject ? (
        <ProjectBadge project={soleProject} avatarSize={16} disableLink />
      ) : projectSlugs.length ? (
        <CreatedProjects projectSlugs={projectSlugs} />
      ) : null}
    </Flex>
  );
}

function CreatedProjects({projectSlugs}: {projectSlugs: string[]}) {
  return (
    <Grid columns="max-content max-content" align="center" gap="md">
      <Text size="sm" variant="muted">
        {tn('Created %s project', 'Created %s projects', projectSlugs.length)}
      </Text>
      <ProjectList projectSlugs={projectSlugs} maxVisibleProjects={3} />
    </Grid>
  );
}

export function AgenticProgress({
  run,
  onboardingCode = run.onboardingCode,
}: {
  run: AgenticProgressRun;
  onboardingCode?: string;
}) {
  const createProjectStage = run.stages.find(stage => stage.stage === 'create_project');
  const projectSlugs = createProjectStage?.extra?.projectSlugs ?? [];
  const verificationStage = run.stages.find(
    stage => stage.stage === 'receive_verification_error'
  );
  // The agent reports every issue the verification error grouped into; the
  // first is the one it sent, and the one worth handing back.
  const firstIssueId = verificationStage?.extra?.issueIds?.[0];
  const isComplete = run.runStatus === 'completed';

  return (
    <Stack width="100%" gap="md">
      <AnimatePresence initial={false} mode="popLayout">
        {isComplete ? (
          <MotionContainer
            key="summary"
            width="100%"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
          >
            <AgenticProgressSummary projectSlugs={projectSlugs} />
          </MotionContainer>
        ) : (
          <MotionContainer
            key="list"
            width="100%"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
          >
            <AgenticProgressList
              stages={run.stages}
              extraContentByStage={
                projectSlugs.length
                  ? {create_project: <CreatedProjects projectSlugs={projectSlugs} />}
                  : undefined
              }
            />
          </MotionContainer>
        )}
      </AnimatePresence>
      {isComplete && firstIssueId ? (
        <MotionContainer
          width="100%"
          initial={{opacity: 0, y: 8}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.15, duration: 0.25, ease: 'easeOut'}}
        >
          <FirstIssueCard issueId={firstIssueId} />
        </MotionContainer>
      ) : null}
      <AgenticProgressMeta
        isComplete={isComplete}
        onboardingCode={onboardingCode}
        updatedAt={run.updatedAt}
      />
    </Stack>
  );
}

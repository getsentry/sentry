import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Tag} from '@sentry/scraps/badge';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ProjectList} from 'sentry/components/projectList';
import {
  IconCircle,
  IconCircleCheckmark,
  IconFatal,
  IconNot,
  IconPieHalf,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';

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

  return <IconCircle size="md" variant="muted" />;
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
    <Grid
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
    </Grid>
  );
}

export function AgenticProgressList({
  extraContentByStage,
  stages,
}: {
  stages: AgenticProgressStageState[];
  extraContentByStage?: Partial<Record<AgenticProgressStage, React.ReactNode>>;
}) {
  return (
    <Stack width="100%" border="muted" radius="lg" overflow="hidden" gap="0">
      {stages.map((stage, index) => (
        <ProgressItem
          key={stage.stage}
          stage={stage}
          isLast={index === stages.length - 1}
          extraContent={extraContentByStage?.[stage.stage]}
        />
      ))}
    </Stack>
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

export function AgenticProgress({run}: {run: AgenticProgressRun}) {
  const createProjectStage = run.stages.find(stage => stage.stage === 'create_project');
  const projectSlugs = createProjectStage?.extra?.projectSlugs ?? [];

  return (
    <AgenticProgressList
      stages={run.stages}
      extraContentByStage={
        projectSlugs.length
          ? {create_project: <CreatedProjects projectSlugs={projectSlugs} />}
          : undefined
      }
    />
  );
}

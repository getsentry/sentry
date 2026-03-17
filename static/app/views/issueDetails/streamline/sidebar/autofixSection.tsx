import {useCallback, useMemo, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import seerConfigConnectImg from 'sentry-images/spot/seer-config-connect-2.svg';

import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  getOrderedAutofixArtifacts,
  isCodeChangesArtifact,
  isCodingAgentsArtifact,
  isPullRequestsArtifact,
  isRootCauseArtifact,
  isSolutionArtifact,
  useExplorerAutofix,
  type AutofixArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesPreview,
  CodingAgentPreview,
  PullRequestsPreview,
  RootCausePreview,
  SolutionPreview,
} from 'sentry/components/events/autofix/v3/autofixPreviews';
import Placeholder from 'sentry/components/placeholder';
import {IconBug} from 'sentry/icons';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {Resources} from 'sentry/views/issueDetails/streamline/sidebar/resources';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/streamline/sidebar/seerDrawer';

interface AutofixSectionProps {
  group: Group;
  project: Project;
  event?: Event;
}

export function AutofixSection({group, project, event}: AutofixSectionProps) {
  const aiConfig = useAiConfig(group, project);

  const issueTypeConfig = getConfigForIssueType(group, project);

  const issueTypeSupportsSeer = Boolean(
    issueTypeConfig.autofix || issueTypeConfig.issueSummary
  );

  if (!aiConfig.areAiFeaturesAllowed || !issueTypeSupportsSeer) {
    if (!issueTypeConfig.resources) {
      return null;
    }

    return (
      <SidebarFoldSection
        title={
          <Flex>
            <Text size="md">{t('Resources')}</Text>
          </Flex>
        }
        sectionKey={SectionKey.SEER}
        preventCollapse={false}
      >
        <Resources
          configResources={issueTypeConfig.resources}
          eventPlatform={event?.platform}
          group={group}
        />
      </SidebarFoldSection>
    );
  }

  return (
    <SidebarFoldSection
      title={
        <Flex align="center" gap="xs">
          <Text size="md">{t('Seer')}</Text>
          <IconSeer />
        </Flex>
      }
      sectionKey={SectionKey.SEER}
      preventCollapse={false}
    >
      <AutofixContent group={group} project={project} event={event} />
    </SidebarFoldSection>
  );
}

interface AutofixContentProps {
  group: Group;
  project: Project;
  event?: Event;
}

function AutofixContent({group, project, event}: AutofixContentProps) {
  const autofix = useExplorerAutofix(group.id);
  const artifacts = useMemo(
    () => getOrderedAutofixArtifacts(autofix.runState),
    [autofix.runState]
  );

  if (autofix.isLoading || !event) {
    return <Placeholder height="160px" />;
  }

  if (!artifacts.length) {
    return (
      <AutofixEmptyState
        autofix={autofix}
        event={event}
        group={group}
        project={project}
      />
    );
  }

  return (
    <AutofixPreviews
      artifacts={artifacts}
      event={event}
      group={group}
      project={project}
    />
  );
}

interface AutofixEmptyStateProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  event: Event;
  group: Group;
  project: Project;
}

function AutofixEmptyState({autofix, group, event, project}: AutofixEmptyStateProps) {
  const {openSeerDrawer} = useOpenSeerDrawer({
    group,
    project,
    event,
  });

  // extract startStep first here so we can depend on it directly as `autofix` itself is unstable.
  const startStep = autofix.startStep;

  const handleStartRootCause = useCallback(() => {
    startStep('root_cause');
    openSeerDrawer();
  }, [startStep, openSeerDrawer]);

  return (
    <Flex direction="column" gap="md">
      <Flex
        border="muted"
        radius="md"
        padding="lg"
        gap="lg"
        align="center"
        justify="between"
      >
        <Container>
          <Text>{t('Have Seer...')}</Text>
          <Container as="ol" margin="0">
            <li>{t('Determine the root cause of your issue')}</li>
            <li>{t('Outline a plan')}</li>
            <li>{t('Create a code fix')}</li>
          </Container>
        </Container>
        <ImageContainer
          justify="end"
          align="center"
          aspectRatio="9 / 16"
          height={{'2xs': '78px', lg: '98px'}}
        >
          <Image src={seerConfigConnectImg} alt="" width="auto" height="100%" />
        </ImageContainer>
      </Flex>
      <Button
        size="md"
        icon={<IconBug />}
        aria-label={t('Fix the Issue')}
        tooltipProps={{title: t('Fix the Issue')}}
        priority="primary"
        onClick={handleStartRootCause}
      >
        {t('Fix the Issue')}
      </Button>
    </Flex>
  );
}

interface AutofixPreviewsProps {
  artifacts: AutofixArtifact[];
  event: Event;
  group: Group;
  project: Project;
}

function AutofixPreviews({artifacts, event, group, project}: AutofixPreviewsProps) {
  const {openSeerDrawer} = useOpenSeerDrawer({
    group,
    project,
    event,
  });

  return (
    <Flex direction="column" gap="xl">
      {artifacts.map(artifact => {
        // there should only be 1 artifact of each type
        if (isRootCauseArtifact(artifact)) {
          return <RootCausePreview key="root-cause" artifact={artifact} />;
        }

        if (isSolutionArtifact(artifact)) {
          return <SolutionPreview key="solution" artifact={artifact} />;
        }

        if (isCodeChangesArtifact(artifact)) {
          return <CodeChangesPreview key="code-changes" artifact={artifact} />;
        }

        if (isPullRequestsArtifact(artifact)) {
          return <PullRequestsPreview key="pull-requests" artifact={artifact} />;
        }

        if (isCodingAgentsArtifact(artifact)) {
          return <CodingAgentPreview key="coding-agent" artifact={artifact} />;
        }

        // TODO: maybe send a log?
        return null;
      })}
      <Button
        size="md"
        icon={<IconSeer />}
        aria-label={t('Open Seer')}
        tooltipProps={{title: t('Open Seer')}}
        priority="primary"
        onClick={openSeerDrawer}
      >
        {t('Open Seer')}
      </Button>
    </Flex>
  );
}

const ImageContainer = styled(Flex)<{
  aspectRatio?: CSSProperties['aspectRatio'];
}>`
  ${p => p.aspectRatio && `aspect-ratio: ${p.aspectRatio}`};
`;

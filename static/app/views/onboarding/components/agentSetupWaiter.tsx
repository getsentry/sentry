import {useEffect} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CircleIndicator} from 'sentry/components/circleIndicator';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {pulsingIndicatorStyles} from 'sentry/styles/pulsingIndicator';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {createIssueLink} from 'sentry/views/issueList/utils';

const DEFAULT_POLL_INTERVAL_MS = 5000;
const ICON_SIZE = SvgIcon.ICON_SIZES.xs;

interface AgentSetupWaiterProps {
  /**
   * How often to poll for each milestone.
   */
  pollInterval?: number;
}

/**
 * Waits for the agent to create a project. Projects that already exist when this
 * mounts are recorded and ignored, so an org that arrives here with projects
 * doesn't report one of those as the agent's work.
 */
function useAgentCreatedProject(pollInterval: number): Project | undefined {
  const organization = useOrganization();
  const {agentSetupProjectBaseline, setAgentSetupProjectBaseline} =
    useOnboardingContext();
  const preexistingProjectIds =
    agentSetupProjectBaseline?.organizationId === organization.id
      ? agentSetupProjectBaseline.projectIds
      : undefined;

  const findNewProject = (candidates: Project[] | undefined) =>
    preexistingProjectIds
      ? candidates?.find(project => !preexistingProjectIds.includes(project.id))
      : undefined;

  const {data: projects} = useQuery({
    ...apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    }),
    refetchInterval: query =>
      findNewProject(query.state.data?.json) ? false : pollInterval,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (projects && !preexistingProjectIds) {
      setAgentSetupProjectBaseline({
        organizationId: organization.id,
        projectIds: projects.map(project => project.id),
      });
    }
  }, [organization.id, preexistingProjectIds, projects, setAgentSetupProjectBaseline]);

  return findNewProject(projects);
}

/**
 * Waits for the first issue to land in the project the agent created. Any issue
 * in a project that new is the verification event.
 */
function useFirstIssue(
  project: Project | undefined,
  pollInterval: number
): Group | undefined {
  const organization = useOrganization();

  const {data: issues} = useQuery({
    ...apiOptions.as<Group[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/issues/',
      {
        path: project
          ? {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug}
          : skipToken,
        staleTime: 0,
      }
    ),
    refetchInterval: query => (query.state.data?.json.length ? false : pollInterval),
    refetchOnWindowFocus: true,
  });

  return issues?.[0];
}

/**
 * The dot leading a step: pulsing while the step is what we're waiting on, and
 * a resting grey circle until then.
 */
function StepSymbol({active, done}: {active: boolean; done: boolean}) {
  const theme = useTheme();

  if (done) {
    return <IconCheckmark size="xs" variant="success" />;
  }

  return active ? (
    <WaitingIndicator />
  ) : (
    <CircleIndicator size={8} color={theme.tokens.graphics.neutral.moderate} />
  );
}

const WaitingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
`;

/**
 * Tracks the agent through the two milestones it can't report back itself:
 * creating the project, then sending the verification error. Both steps are
 * always listed so the shape of what's coming is visible from the start, and
 * each resolves in place as the agent gets there.
 */
export function AgentSetupWaiter({
  pollInterval = DEFAULT_POLL_INTERVAL_MS,
}: AgentSetupWaiterProps) {
  const location = useLocation();
  const organization = useOrganization();
  const project = useAgentCreatedProject(pollInterval);
  const firstIssue = useFirstIssue(project, pollInterval);

  return (
    <Stack gap="xs">
      <Flex align="center" gap="xs">
        <Flex
          align="center"
          justify="center"
          width={ICON_SIZE}
          height={ICON_SIZE}
          flexShrink={0}
        >
          <StepSymbol done={!!project} active />
        </Flex>
        {project ? (
          // The badge renders as a flex row, so it sits beside the label rather
          // than inside it.
          <Flex align="center" gap="xs">
            <Text size="sm" variant="muted">
              {t('Project created:')}
            </Text>
            <ProjectBadge project={project} avatarSize={16} disableLink />
          </Flex>
        ) : (
          <Text size="sm" variant="promotion">
            {t('Waiting for project creation')}
          </Text>
        )}
      </Flex>
      <Flex align="center" gap="xs">
        <Flex
          align="center"
          justify="center"
          width={ICON_SIZE}
          height={ICON_SIZE}
          flexShrink={0}
        >
          <StepSymbol done={!!firstIssue} active={!!project} />
        </Flex>
        {firstIssue ? (
          <Tooltip title={t('View the verification error')} skipWrapper>
            <Link
              to={createIssueLink({
                organization,
                location,
                data: firstIssue,
                referrer: 'onboarding-agentic-setup',
              })}
            >
              <Text size="sm" variant="inherit">
                {getMessage(firstIssue) || getTitle(firstIssue).title}
              </Text>
            </Link>
          </Tooltip>
        ) : (
          <Text size="sm" variant={project ? 'promotion' : 'muted'}>
            {t('Waiting for verification error')}
          </Text>
        )}
      </Flex>
    </Stack>
  );
}

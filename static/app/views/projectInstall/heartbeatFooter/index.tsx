import {Fragment, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import Placeholder from 'sentry/components/placeholder';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {useHeartbeat} from './useHeartbeat';

enum BeatStatus {
  AWAITING = 'awaiting',
  PENDING = 'pending',
  COMPLETE = 'complete',
}

async function openChangeRouteModal(
  router: RouteComponentProps<{}, {}>['router'],
  nextLocation: Location
) {
  const mod = await import(
    'sentry/views/projectInstall/heartbeatFooter/changeRouteModal'
  );
  const {ChangeRouteModal} = mod;

  openModal(deps => (
    <ChangeRouteModal {...deps} router={router} nextLocation={nextLocation} />
  ));
}

type Props = Pick<RouteComponentProps<{}, {}>, 'router' | 'route'> & {
  issueStreamLink: string;
  performanceOverviewLink: string;
  projectSlug: Project['slug'];
};

export function HeartbeatFooter({
  issueStreamLink,
  performanceOverviewLink,
  projectSlug,
  router,
  route,
}: Props) {
  const organization = useOrganization();

  const {initiallyLoaded, fetchError, fetching, projects} = useProjects({
    orgId: organization.id,
    slugs: [projectSlug],
  });

  const projectsLoading = !initiallyLoaded && fetching;

  const project =
    !projectsLoading && !fetchError && projects.length ? projects[0] : undefined;

  const {
    sessionLoading,
    eventLoading,
    firstErrorReceived,
    firstTransactionReceived,
    sessionInProgress,
  } = useHeartbeat({project});

  const serverConnected = sessionInProgress || firstTransactionReceived;

  useEffect(() => {
    const onUnload = (nextLocation?: Location) => {
      if (serverConnected && firstErrorReceived) {
        return true;
      }

      // Next Location is always available when user clicks on a item with a new route
      if (nextLocation) {
        const {query} = nextLocation;

        if (query.setUpRemainingOnboardingTasksLater) {
          return true;
        }

        openChangeRouteModal(router, nextLocation);
        return false;
      }

      return true;
    };

    router.setRouteLeaveHook(route, onUnload);
  }, [serverConnected, firstErrorReceived, route, router]);

  const actions = (
    <Fragment>
      <Button
        busy={projectsLoading}
        to={{
          pathname: performanceOverviewLink,
          query: {project: project?.id},
        }}
      >
        {t('Go to Performance')}
      </Button>
      <Button
        priority="primary"
        busy={projectsLoading}
        to={{
          pathname: issueStreamLink,
          query: {project: project?.id},
          hash: '#welcome',
        }}
      >
        {t('Go to Issues')}
      </Button>
    </Fragment>
  );

  if (!projectsLoading && !project) {
    return (
      <NoProjectWrapper>
        <Actions>{actions}</Actions>
      </NoProjectWrapper>
    );
  }

  return (
    <Wrapper>
      <PlatformIconAndName>
        {projectsLoading ? (
          <LoadingPlaceholder height="28px" width="276px" />
        ) : (
          <IdBadge project={project} avatarSize={28} hideOverflow disableLink />
        )}
      </PlatformIconAndName>
      <Beats>
        {projectsLoading || sessionLoading || eventLoading ? (
          <Fragment>
            <LoadingPlaceholder height="28px" />
            <LoadingPlaceholder height="28px" />
          </Fragment>
        ) : firstErrorReceived ? (
          <Fragment>
            <Beat status={BeatStatus.COMPLETE}>
              <IconCheckmark size="sm" isCircled />
              {t('Server connection established')}
            </Beat>
            <Beat status={BeatStatus.COMPLETE}>
              <IconCheckmark size="sm" isCircled />
              {t('First error received')}
            </Beat>
          </Fragment>
        ) : serverConnected ? (
          <Fragment>
            <Beat status={BeatStatus.COMPLETE}>
              <IconCheckmark size="sm" isCircled />
              {t('Server connection established')}
            </Beat>
            <Beat status={BeatStatus.AWAITING}>
              <PulsingIndicator>2</PulsingIndicator>
              {t('Awaiting first error')}
            </Beat>
          </Fragment>
        ) : (
          <Fragment>
            <Beat status={BeatStatus.AWAITING}>
              <PulsingIndicator>1</PulsingIndicator>
              {t('Awaiting server connection')}
            </Beat>
            <Beat status={BeatStatus.PENDING}>
              <PulsingIndicator>2</PulsingIndicator>
              {t('Awaiting first error')}
            </Beat>
          </Fragment>
        )}
      </Beats>
      <Actions>{actions}</Actions>
    </Wrapper>
  );
}

const NoProjectWrapper = styled('div')`
  position: sticky;
  bottom: 0;
  margin-top: auto;
  width: calc(100% + 2px);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  background: ${p => p.theme.background};
  padding: ${space(2)} 0;
  margin-bottom: -${space(3)};
  margin-left: -1px;
  margin-right: -1px;
  align-items: center;
  z-index: 1;
`;

const Wrapper = styled(NoProjectWrapper)`
  gap: ${space(2)};
  flex-direction: column;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: auto;
    flex-direction: row;
    flex-wrap: wrap;
  }
`;

const PlatformIconAndName = styled('div')`
  max-width: 100%;
  overflow: hidden;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: auto;
    display: grid;
    grid-template-columns: minmax(0, 150px);
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: minmax(0, 276px);
  }
`;

const Beats = styled('div')`
  width: 100%;
  gap: ${space(2)};
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 200px));
  flex: 1;
  justify-content: center;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, 180px);
    width: auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: repeat(2, 200px);
  }
`;

const Actions = styled('div')`
  gap: ${space(1)};
  display: flex;
  justify-content: flex-end;
  width: 100%;
  flex-direction: column;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: auto;
    flex-direction: row;
  }
`;

const LoadingPlaceholder = styled(Placeholder)`
  width: 100%;
  max-width: ${p => p.width};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.white};
  height: 16px;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  :before {
    top: auto;
    left: auto;
  }
`;

const Beat = styled('div')<{status: BeatStatus}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  align-items: center;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: 0;
  width: 100%;
  color: ${p => p.theme.pink300};

  ${p =>
    p.status === BeatStatus.PENDING &&
    css`
      color: ${p.theme.disabled};
      ${PulsingIndicator} {
        background: ${p.theme.disabled};
        :before {
          content: none;
        }
      }
    `}

  ${p =>
    p.status === BeatStatus.COMPLETE &&
    css`
      color: ${p.theme.successText};
      ${PulsingIndicator} {
        background: ${p.theme.success};
        :before {
          content: none;
        }
      }
    `}
`;

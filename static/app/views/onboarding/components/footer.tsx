import {useCallback, useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {IconCheckmark, IconCircle, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {Group, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

import {usePersistedOnboardingState} from '../utils';

import GenericFooter from './genericFooter';

export enum OnboardingStatus {
  WAITING = 'waiting',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
}

type OnboardingState = {
  status: OnboardingStatus;
  firstIssueId?: string;
};

const DEFAULT_POLL_INTERVAL = 5000;

type Props = Pick<RouteComponentProps<{}, {}>, 'router' | 'route' | 'location'> & {
  projectSlug: Project['slug'];
  newOrg?: boolean;
};

async function openChangeRouteModal(
  router: RouteComponentProps<{}, {}>['router'],
  nextLocation: Location
) {
  const mod = await import('sentry/views/onboarding/components/changeRouteModal');

  const {ChangeRouteModal} = mod;

  openModal(deps => (
    <ChangeRouteModal {...deps} router={router} nextLocation={nextLocation} />
  ));
}

export function Footer({projectSlug, router, route, newOrg}: Props) {
  const organization = useOrganization();
  const preferences = useLegacyStore(PreferencesStore);
  const [clientState, setClientState] = usePersistedOnboardingState();
  const [firstError, setFirstError] = useState<string | null>(null);
  const [firstIssue, setFirstIssue] = useState<Group | undefined>(undefined);

  const onboarding_sessionStorage_key = `onboarding-${projectSlug}`;

  const [sessionStorage, setSessionStorage] = useSessionStorage<OnboardingState>(
    onboarding_sessionStorage_key,
    {
      status: OnboardingStatus.WAITING,
      firstIssueId: undefined,
    }
  );

  useQuery<Project>([`/projects/${organization.slug}/${projectSlug}/`], {
    staleTime: 0,
    refetchInterval: DEFAULT_POLL_INTERVAL,
    enabled:
      !!projectSlug && !firstError && sessionStorage.status === OnboardingStatus.WAITING, // Fetch only if the project is available and we have not yet received an error,
    onSuccess: data => {
      setFirstError(data.firstEvent);
    },
  });

  // Locate the projects first issue group. The project.firstEvent field will
  // *not* include sample events, while just looking at the issues list will.
  // We will wait until the project.firstEvent is set and then locate the
  // event given that event datetime
  useQuery<Group[]>([`/projects/${organization.slug}/${projectSlug}/issues/`], {
    staleTime: 0,
    enabled:
      !!firstError &&
      !firstIssue &&
      sessionStorage.status === OnboardingStatus.PROCESSING, // Only fetch if an error event is received and we have not yet located the first issue,
    onSuccess: data => {
      setFirstIssue(data.find((issue: Group) => issue.firstSeen === firstError));
    },
  });

  // The explore button is only showed if Sentry has not yet received any errors OR the issue is still being processed
  const handleExploreSentry = useCallback(() => {
    if (sessionStorage.status === OnboardingStatus.WAITING) {
      return;
    }

    trackAdvancedAnalyticsEvent('onboarding.explore_sentry_button_clicked', {
      organization,
    });

    openChangeRouteModal(router, {
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/`,
    });
  }, [router, organization, sessionStorage.status]);

  useEffect(() => {
    if (!firstError) {
      return;
    }

    if (sessionStorage.status !== OnboardingStatus.WAITING) {
      return;
    }

    trackAdvancedAnalyticsEvent('onboarding.first_error_received', {
      organization,
      new_organization: !!newOrg,
    });

    setSessionStorage({status: OnboardingStatus.PROCESSING});
    addSuccessMessage(t('First error received'));
  }, [firstError, newOrg, organization, setSessionStorage, sessionStorage]);

  useEffect(() => {
    if (!firstIssue) {
      return;
    }

    if (sessionStorage.status !== OnboardingStatus.PROCESSING) {
      return;
    }

    trackAdvancedAnalyticsEvent('onboarding.first_error_processed', {
      organization,
      new_organization: !!newOrg,
    });

    setSessionStorage({status: OnboardingStatus.PROCESSED, firstIssueId: firstIssue.id});
    addSuccessMessage(t('First error processed'));
  }, [firstIssue, newOrg, organization, setSessionStorage, sessionStorage]);

  useEffect(() => {
    const onUnload = (nextLocation?: Location) => {
      if (location.pathname.startsWith('onboarding')) {
        return true;
      }

      // If the user has already sent an error, then we don't show the dialog
      if (
        sessionStorage.status === OnboardingStatus.PROCESSING ||
        sessionStorage.status === OnboardingStatus.PROCESSED
      ) {
        return true;
      }

      // Next Location is always available when user clicks on a item with a new route
      if (!nextLocation) {
        return true;
      }

      if (nextLocation.query.setUpRemainingOnboardingTasksLater) {
        return true;
      }

      // If users are in the onboarding of existing orgs &&
      // have started the SDK instrumentation &&
      // clicks elsewhere else to change the route,
      // then we display the 'are you sure?' dialog.
      openChangeRouteModal(router, nextLocation);

      return false;
    };

    router.setRouteLeaveHook(route, onUnload);
  }, [router, route, organization, sessionStorage.status]);

  const handleViewError = useCallback(() => {
    trackAdvancedAnalyticsEvent('onboarding.view_error_button_clicked', {
      organization,
      new_organization: !!newOrg,
    });

    router.push({
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/${sessionStorage.firstIssueId}/?referrer=onboarding-first-event-footer`,
    });
  }, [organization, newOrg, router, sessionStorage]);

  return (
    <Wrapper newOrg={!!newOrg} sidebarCollapsed={!!preferences.collapsed}>
      <div>
        {sessionStorage.status === OnboardingStatus.WAITING && (
          <SkipOnboardingLink
            onClick={() => {
              trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
                organization,
                source: 'targeted_onboarding_first_event_footer',
              });
              if (clientState) {
                setClientState({
                  ...clientState,
                  state: 'skipped',
                });
              }
            }}
            to={`/organizations/${organization.slug}/issues/?referrer=onboarding-first-event-footer-skip`}
          >
            {t('Skip Onboarding')}
          </SkipOnboardingLink>
        )}
      </div>
      <Statuses>
        {sessionStorage.status === OnboardingStatus.WAITING ? (
          <WaitingForErrorStatus>
            <IconCircle size="sm" />
            {t('Waiting for error')}
          </WaitingForErrorStatus>
        ) : sessionStorage.status === OnboardingStatus.PROCESSED ? (
          <ErrorProcessedStatus>
            <IconCheckmark isCircled size="sm" color="green300" />
            {t('Error Processed!')}
          </ErrorProcessedStatus>
        ) : (
          <ErrorProcessingStatus>
            <RefreshIcon size="sm" />
            {t('Processing error')}
          </ErrorProcessingStatus>
        )}
      </Statuses>
      <Actions>
        {sessionStorage.status === OnboardingStatus.PROCESSED ? (
          <Button priority="primary" onClick={handleViewError}>
            {t('View Error')}
          </Button>
        ) : (
          <Button
            priority="primary"
            disabled={sessionStorage.status === OnboardingStatus.WAITING}
            onClick={handleExploreSentry}
            title={
              sessionStorage.status === OnboardingStatus.WAITING
                ? t('Waiting for error')
                : undefined
            }
          >
            {t('Explore Sentry')}
          </Button>
        )}
      </Actions>
    </Wrapper>
  );
}

const Wrapper = styled(GenericFooter, {
  shouldForwardProp: prop => isPropValid(prop),
})<{
  newOrg: boolean;
  sidebarCollapsed: boolean;
}>`
  display: none;
  display: flex;
  flex-direction: row;
  padding: ${space(2)} ${space(4)};
  justify-content: space-between;
  align-items: center;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: center;
    gap: ${space(3)};
  }
  ${p =>
    !p.newOrg &&
    css`
      @media (min-width: ${p.theme.breakpoints.medium}) {
        width: calc(
          100% -
            ${p.theme.sidebar[p.sidebarCollapsed ? 'collapsedWidth' : 'expandedWidth']}
        );
        right: 0;
        left: auto;
      }
    `}
`;

const SkipOnboardingLink = styled(Link)`
  border-radius: 0;
  white-space: nowrap;
`;

const Statuses = styled('div')`
  display: flex;
  justify-content: center;
`;

const Actions = styled('div')`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    justify-content: flex-end;
  }
`;

const WaitingForErrorStatus = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(0.75)};
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  border: 1.5px solid ${p => p.theme.gray500};
  border-radius: 76px;
  color: ${p => p.theme.gray500};
  line-height: ${p => p.theme.fontSizeLarge};
`;

const ErrorProcessingStatus = styled(WaitingForErrorStatus)`
  border-color: ${p => p.theme.gray200};
  color: ${p => p.theme.gray300};
  position: relative;

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
`;

const ErrorProcessedStatus = styled(WaitingForErrorStatus)`
  background: ${p => p.theme.gray500};
  color: ${p => p.theme.white};
`;

const RefreshIcon = styled(IconRefresh)`
  animation: rotate 1s linear infinite;
`;

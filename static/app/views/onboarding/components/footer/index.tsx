import {useCallback, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

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

import {usePersistedOnboardingState} from '../../utils';
import GenericFooter from '../genericFooter';

const DEFAULT_POLL_INTERVAL = 5000;

type Props = Pick<RouteComponentProps<{}, {}>, 'router' | 'route' | 'location'> & {
  projectSlug: Project['slug'];
  newOrg?: boolean;
};

async function openChangeRouteModal(
  router: RouteComponentProps<{}, {}>['router'],
  nextLocation: Location
) {
  const mod = await import(
    'sentry/views/onboarding/components/heartbeatFooter/changeRouteModal'
  );

  const {ChangeRouteModal} = mod;

  openModal(deps => (
    <ChangeRouteModal {...deps} router={router} nextLocation={nextLocation} />
  ));
}

export function Footer({projectSlug, router, newOrg}: Props) {
  const organization = useOrganization();
  const preferences = useLegacyStore(PreferencesStore);
  const [clientState, setClientState] = usePersistedOnboardingState();
  const [firstError, setFirstError] = useState<string | null>(null);
  const [firstIssue, setFirstIssue] = useState<Group | undefined>(undefined);

  useQuery<Project>([`/projects/${organization.slug}/${projectSlug}/`], {
    staleTime: 0,
    refetchInterval: DEFAULT_POLL_INTERVAL,
    enabled: !!projectSlug && !firstError, // Fetch only if the project is available and we have not yet received an error,
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
    enabled: !!firstError && !firstIssue, // Only fetch if an error event is received and we have not yet located the first issue,
    onSuccess: data => {
      setFirstIssue(data.find((issue: Group) => issue.firstSeen === firstError));
    },
  });

  // The explore button is only showed if Sentry has not yet received any errors OR the issue is still being processed
  const handleExploreSentry = useCallback(() => {
    trackAdvancedAnalyticsEvent('heartbeat.onboarding_explore_sentry_button_clicked', {
      organization,
    });

    openChangeRouteModal(router, {
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/`,
    });
  }, [router, organization]);

  const handleViewError = useCallback(() => {
    trackAdvancedAnalyticsEvent('heartbeat.onboarding_go_to_my_error_button_clicked', {
      organization,
      new_organization: !!newOrg,
    });

    router.push({
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/${firstIssue}/?referrer=onboarding-first-event-footer`,
    });
  }, [organization, newOrg, router, firstIssue]);

  return (
    <Wrapper newOrg={!!newOrg} sidebarCollapsed={!!preferences.collapsed}>
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
      <Statuses>
        {!firstError ? (
          <WaitingForErrorStatus>
            <IconCircle size="sm" />
            {t('Waiting for error')}
          </WaitingForErrorStatus>
        ) : firstIssue ? (
          <ErrorProcessedStatus>
            <IconCheckmark isCircled size="sm" color="green300" />
            {t('Error Processed!')}
          </ErrorProcessedStatus>
        ) : (
          <ErrorProcessingStatus>
            <IconRefresh size="sm" />
            {t('Processing error')}
          </ErrorProcessingStatus>
        )}
      </Statuses>
      <Actions>
        {firstIssue ? (
          <Button priority="primary" onClick={handleViewError}>
            {t('View Error')}
          </Button>
        ) : (
          <Button
            priority="primary"
            disabled={!firstError}
            onClick={handleExploreSentry}
            title={t('Waiting for error')}
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
`;

const ErrorProcessedStatus = styled(WaitingForErrorStatus)`
  background: ${p => p.theme.gray500};
  color: ${p => p.theme.white};
`;

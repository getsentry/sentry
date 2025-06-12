import styled from '@emotion/styled';
import type {Location} from 'history';
import pick from 'lodash/pick';

import {SectionHeading} from 'sentry/components/charts/styles';
import {AlertBadge} from 'sentry/components/core/badge/alertBadge';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {IconCheckmark, IconExclamation, IconFire, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {Incident} from 'sentry/views/alerts/types';
import {IncidentStatus} from 'sentry/views/alerts/types';

import MissingAlertsButtons from './missingFeatureButtons/missingAlertsButtons';
import {SectionHeadingLink, SectionHeadingWrapper, SidebarSection} from './styles';

const PLACEHOLDER_AND_EMPTY_HEIGHT = '172px';

interface AlertRowProps {
  alert: Incident;
}

function AlertRow({alert}: AlertRowProps) {
  const organization = useOrganization();
  const {status, identifier, title, dateClosed, dateStarted} = alert;
  const isResolved = status === IncidentStatus.CLOSED;
  const isWarning = status === IncidentStatus.WARNING;

  const Icon = isResolved ? IconCheckmark : isWarning ? IconExclamation : IconFire;

  const statusProps = {isResolved, isWarning};

  return (
    <AlertRowLink
      aria-label={title}
      to={makeAlertsPathname({
        path: `/${identifier}/`,
        organization,
      })}
    >
      <AlertBadgeWrapper icon={Icon}>
        <AlertBadge status={status} />
      </AlertBadgeWrapper>
      <AlertDetails>
        <AlertTitle>{title}</AlertTitle>
        <AlertDate {...statusProps}>
          {isResolved ? t('Resolved') : t('Triggered')}{' '}
          {isResolved ? (
            dateClosed ? (
              <TimeSince date={dateClosed} />
            ) : null
          ) : (
            <TimeSince
              date={dateStarted}
              tooltipUnderlineColor={getStatusColor(statusProps)}
            />
          )}
        </AlertDate>
      </AlertDetails>
    </AlertRowLink>
  );
}

interface ProjectLatestAlertsProps {
  isProjectStabilized: boolean;
  location: Location;
  organization: Organization;
  projectSlug: string;
}

function ProjectLatestAlerts({
  location,
  organization,
  isProjectStabilized,
  projectSlug,
}: ProjectLatestAlertsProps) {
  const query = {
    ...pick(location.query, Object.values(URL_PARAM)),
    per_page: 3,
  };
  const {
    data: unresolvedAlerts = [],
    isPending: unresolvedAlertsIsLoading,
    isError: unresolvedAlertsIsError,
  } = useApiQuery<Incident[]>(
    [
      `/organizations/${organization.slug}/incidents/`,
      {query: {...query, status: 'open'}},
    ],
    {staleTime: 0, enabled: isProjectStabilized}
  );
  const {
    data: resolvedAlerts = [],
    isPending: resolvedAlertsIsLoading,
    isError: resolvedAlertsIsError,
  } = useApiQuery<Incident[]>(
    [
      `/organizations/${organization.slug}/incidents/`,
      {query: {...query, status: 'closed'}},
    ],
    {staleTime: 0, enabled: isProjectStabilized}
  );

  const alertsUnresolvedAndResolved = [...unresolvedAlerts, ...resolvedAlerts];
  const shouldLoadAlertRules =
    alertsUnresolvedAndResolved.length === 0 &&
    !unresolvedAlertsIsLoading &&
    !resolvedAlertsIsLoading;
  // This is only used to determine if we should show the "Create Alert" button
  const {data: alertRules = [], isPending: alertRulesLoading} = useApiQuery<any[]>(
    [
      `/organizations/${organization.slug}/alert-rules/`,
      {
        query: {
          ...pick(location.query, Object.values(URL_PARAM)),
          // Sort by name
          asc: 1,
          per_page: 1,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: shouldLoadAlertRules,
    }
  );

  function renderAlertRules() {
    if (unresolvedAlertsIsError || resolvedAlertsIsError) {
      return <LoadingError message={t('Unable to load latest alerts')} />;
    }

    const isLoading = unresolvedAlertsIsLoading || resolvedAlertsIsLoading;
    if (isLoading || (shouldLoadAlertRules && alertRulesLoading)) {
      return <Placeholder height={PLACEHOLDER_AND_EMPTY_HEIGHT} />;
    }

    const hasAlertRule = alertsUnresolvedAndResolved.length > 0 || alertRules?.length > 0;
    if (!hasAlertRule) {
      return (
        <MissingAlertsButtons organization={organization} projectSlug={projectSlug} />
      );
    }

    if (alertsUnresolvedAndResolved.length === 0) {
      return (
        <StyledEmptyStateWarning small>{t('No alerts found')}</StyledEmptyStateWarning>
      );
    }

    return alertsUnresolvedAndResolved
      .slice(0, 3)
      .map(alert => <AlertRow key={alert.id} alert={alert} />);
  }

  return (
    <SidebarSection>
      <SectionHeadingWrapper>
        <SectionHeading>{t('Latest Alerts')}</SectionHeading>
        {/* as this is a link to latest alerts, we want to only preserve project and environment */}
        <SectionHeadingLink
          to={{
            pathname: makeAlertsPathname({
              path: `/`,
              organization,
            }),
            query: {
              statsPeriod: undefined,
              start: undefined,
              end: undefined,
              utc: undefined,
            },
          }}
        >
          <IconOpen aria-label={t('Metric Alert History')} />
        </SectionHeadingLink>
      </SectionHeadingWrapper>

      <div>{renderAlertRules()}</div>
    </SidebarSection>
  );
}

const AlertRowLink = styled(Link)`
  display: flex;
  align-items: center;
  height: 40px;
  margin-bottom: ${space(3)};
  margin-left: ${space(0.5)};
  &,
  &:hover,
  &:focus {
    color: inherit;
  }
  &:first-child {
    margin-top: ${space(1)};
  }
`;

type StatusColorProps = {
  isResolved: boolean;
  isWarning: boolean;
};

const getStatusColor = ({isResolved, isWarning}: StatusColorProps) =>
  isResolved ? 'successText' : isWarning ? 'warningText' : 'errorText';

const AlertBadgeWrapper = styled('div')<{icon: typeof IconExclamation}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* icon warning needs to be treated differently to look visually centered */
  line-height: ${p => (p.icon === IconExclamation ? undefined : 1)};
`;

const AlertDetails = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-left: ${space(1.5)};
  ${p => p.theme.overflowEllipsis}
  line-height: 1.35;
`;

const AlertTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightNormal};
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlertDate = styled('span')<StatusColorProps>`
  color: ${p => p.theme[getStatusColor(p)]};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: ${PLACEHOLDER_AND_EMPTY_HEIGHT};
  justify-content: center;
`;

export default ProjectLatestAlerts;

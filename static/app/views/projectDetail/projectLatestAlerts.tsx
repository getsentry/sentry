import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import AlertBadge from 'sentry/components/alertBadge';
import AsyncComponent from 'sentry/components/asyncComponent';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {IconCheckmark, IconExclamation, IconFire, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Theme} from 'sentry/utils/theme';

import {Incident, IncidentStatus} from '../alerts/types';

import MissingAlertsButtons from './missingFeatureButtons/missingAlertsButtons';
import {SectionHeadingLink, SectionHeadingWrapper, SidebarSection} from './styles';
import {didProjectOrEnvironmentChange} from './utils';

const PLACEHOLDER_AND_EMPTY_HEIGHT = '172px';

type Props = AsyncComponent['props'] & {
  isProjectStabilized: boolean;
  location: Location;
  organization: Organization;
  projectSlug: string;
};

type State = {
  resolvedAlerts: Incident[] | null;
  unresolvedAlerts: Incident[] | null;
  hasAlertRule?: boolean;
} & AsyncComponent['state'];

class ProjectLatestAlerts extends AsyncComponent<Props, State> {
  shouldComponentUpdate(nextProps: Props, nextState: State) {
    const {location, isProjectStabilized} = this.props;
    // TODO(project-detail): we temporarily removed refetching based on timeselector
    if (
      this.state !== nextState ||
      didProjectOrEnvironmentChange(location, nextProps.location) ||
      isProjectStabilized !== nextProps.isProjectStabilized
    ) {
      return true;
    }

    return false;
  }

  componentDidUpdate(prevProps: Props) {
    const {location, isProjectStabilized} = this.props;

    if (
      didProjectOrEnvironmentChange(prevProps.location, location) ||
      prevProps.isProjectStabilized !== isProjectStabilized
    ) {
      this.remountComponent();
    }
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {location, organization, isProjectStabilized} = this.props;

    if (!isProjectStabilized) {
      return [];
    }

    const query = {
      ...pick(location.query, Object.values(URL_PARAM)),
      per_page: 3,
    };

    // we are listing 3 alerts total, first unresolved and then we fill with resolved
    return [
      [
        'unresolvedAlerts',
        `/organizations/${organization.slug}/incidents/`,
        {query: {...query, status: 'open'}},
      ],
      [
        'resolvedAlerts',
        `/organizations/${organization.slug}/incidents/`,
        {query: {...query, status: 'closed'}},
      ],
    ];
  }

  /**
   * If our alerts are empty, determine if we've configured alert rules (empty message differs then)
   */
  async onLoadAllEndpointsSuccess() {
    const {unresolvedAlerts, resolvedAlerts} = this.state;
    const {location, organization, isProjectStabilized} = this.props;

    if (!isProjectStabilized) {
      return;
    }

    if ([...(unresolvedAlerts ?? []), ...(resolvedAlerts ?? [])].length !== 0) {
      this.setState({hasAlertRule: true});
      return;
    }

    this.setState({loading: true});

    const alertRules = await this.api.requestPromise(
      `/organizations/${organization.slug}/alert-rules/`,
      {
        method: 'GET',
        query: {
          ...pick(location.query, [...Object.values(URL_PARAM)]),
          per_page: 1,
        },
      }
    );

    this.setState({hasAlertRule: alertRules.length > 0, loading: false});
  }

  get alertsLink() {
    const {organization} = this.props;

    // as this is a link to latest alerts, we want to only preserve project and environment
    return {
      pathname: `/organizations/${organization.slug}/alerts/`,
      query: {
        statsPeriod: undefined,
        start: undefined,
        end: undefined,
        utc: undefined,
      },
    };
  }

  renderAlertRow = (alert: Incident) => {
    const {organization} = this.props;
    const {status, id, identifier, title, dateClosed, dateStarted} = alert;
    const isResolved = status === IncidentStatus.CLOSED;
    const isWarning = status === IncidentStatus.WARNING;

    const Icon = isResolved ? IconCheckmark : isWarning ? IconExclamation : IconFire;

    const statusProps = {isResolved, isWarning};

    return (
      <AlertRowLink
        to={`/organizations/${organization.slug}/alerts/${identifier}/`}
        key={id}
      >
        <AlertBadgeWrapper {...statusProps} icon={Icon}>
          <AlertBadge status={status} hideText />
        </AlertBadgeWrapper>
        <AlertDetails>
          <AlertTitle>{title}</AlertTitle>
          <AlertDate {...statusProps}>
            {isResolved
              ? tct('Resolved [date]', {
                  date: dateClosed ? <TimeSince date={dateClosed} /> : null,
                })
              : tct('Triggered [date]', {date: <TimeSince date={dateStarted} />})}
          </AlertDate>
        </AlertDetails>
      </AlertRowLink>
    );
  };

  renderInnerBody() {
    const {organization, projectSlug, isProjectStabilized} = this.props;
    const {loading, unresolvedAlerts, resolvedAlerts, hasAlertRule} = this.state;
    const alertsUnresolvedAndResolved = [
      ...(unresolvedAlerts ?? []),
      ...(resolvedAlerts ?? []),
    ];
    const checkingForAlertRules =
      alertsUnresolvedAndResolved.length === 0 && hasAlertRule === undefined;
    const showLoadingIndicator = loading || checkingForAlertRules || !isProjectStabilized;

    if (showLoadingIndicator) {
      return <Placeholder height={PLACEHOLDER_AND_EMPTY_HEIGHT} />;
    }

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

    return alertsUnresolvedAndResolved.slice(0, 3).map(this.renderAlertRow);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return (
      <SidebarSection>
        <SectionHeadingWrapper>
          <SectionHeading>{t('Latest Alerts')}</SectionHeading>
          <SectionHeadingLink to={this.alertsLink}>
            <IconOpen />
          </SectionHeadingLink>
        </SectionHeadingWrapper>

        <div>{this.renderInnerBody()}</div>
      </SidebarSection>
    );
  }
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

const getStatusColor = ({
  theme,
  isResolved,
  isWarning,
}: {theme: Theme} & StatusColorProps) =>
  isResolved ? theme.green300 : isWarning ? theme.yellow300 : theme.red300;

const AlertBadgeWrapper = styled('div')<{icon: React.ReactNode} & StatusColorProps>`
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
  ${overflowEllipsis}
  line-height: 1.35;
`;

const AlertTitle = styled('div')`
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlertDate = styled('span')<StatusColorProps>`
  color: ${p => getStatusColor(p)};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: ${PLACEHOLDER_AND_EMPTY_HEIGHT};
  justify-content: center;
`;

export default ProjectLatestAlerts;

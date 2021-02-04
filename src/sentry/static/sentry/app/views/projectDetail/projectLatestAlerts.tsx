import React from 'react';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';
import pick from 'lodash/pick';

import AsyncComponent from 'app/components/asyncComponent';
import {SectionHeading} from 'app/components/charts/styles';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import TimeSince from 'app/components/timeSince';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {IconCheckmark, IconFire, IconOpen, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {Theme} from 'app/utils/theme';

import {Incident, IncidentStatus} from '../alerts/types';

import MissingAlertsButtons from './missingFeatureButtons/missingAlertsButtons';
import {SectionHeadingLink, SectionHeadingWrapper, SidebarSection} from './styles';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projectSlug: string;
  location: Location;
  theme: Theme;
};

type State = {
  unresolvedAlerts: Incident[] | null;
  resolvedAlerts: Incident[] | null;
  hasAlertRule?: boolean;
} & AsyncComponent['state'];

class ProjectLatestAlerts extends AsyncComponent<Props, State> {
  shouldComponentUpdate(nextProps: Props, nextState: State) {
    // TODO(project-detail): we temporarily removed refetching based on timeselector
    if (
      this.state !== nextState ||
      this.props.location.query.environment !== nextProps.location.query.environment
    ) {
      return true;
    }

    return false;
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {location, organization} = this.props;

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
    const {location, organization} = this.props;

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
    const {organization, theme} = this.props;
    const {status, id, identifier, title, dateClosed, dateStarted} = alert;
    const isResolved = status === IncidentStatus.CLOSED;
    const isWarning = status === IncidentStatus.WARNING;

    const color = isResolved
      ? theme.green300
      : isWarning
      ? theme.yellow300
      : theme.red300;
    const Icon = isResolved ? IconCheckmark : isWarning ? IconWarning : IconFire;

    return (
      <AlertRowLink
        to={`/organizations/${organization.slug}/alerts/${identifier}/`}
        key={id}
      >
        <AlertBadge color={color} icon={Icon}>
          <AlertIconWrapper>
            <Icon color="white" />
          </AlertIconWrapper>
        </AlertBadge>
        <AlertDetails>
          <AlertTitle>{title}</AlertTitle>
          <AlertDate color={color}>
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
    const {organization, projectSlug} = this.props;
    const {loading, unresolvedAlerts, resolvedAlerts, hasAlertRule} = this.state;
    const alertsUnresolvedAndResolved = [
      ...(unresolvedAlerts ?? []),
      ...(resolvedAlerts ?? []),
    ];
    const checkingForAlertRules =
      alertsUnresolvedAndResolved.length === 0 && hasAlertRule === undefined;
    const showLoadingIndicator = loading || checkingForAlertRules;

    if (showLoadingIndicator) {
      return <Placeholder height="172px" />;
    }

    if (!hasAlertRule) {
      return (
        <MissingAlertsButtons organization={organization} projectSlug={projectSlug} />
      );
    }

    if (alertsUnresolvedAndResolved.length === 0) {
      return t('No alert triggered so far.');
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

const AlertBadge = styled('div')<{color: string; icon: React.ReactNode}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* icon warning needs to be treated differently to look visually centered */
  line-height: ${p => (p.icon === IconWarning ? undefined : 1)};

  &:before {
    content: '';
    width: 30px;
    height: 30px;
    border-radius: ${p => p.theme.borderRadius};
    background-color: ${p => p.color};
    transform: rotate(45deg);
  }
`;

const AlertIconWrapper = styled('div')`
  position: absolute;
`;

const AlertDetails = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-left: ${space(2)};
  ${overflowEllipsis}
`;

const AlertTitle = styled('div')`
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlertDate = styled('span')<{color: string}>`
  color: ${p => p.color};
`;

export default withTheme(ProjectLatestAlerts);

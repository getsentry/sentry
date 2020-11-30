import React from 'react';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';
import pick from 'lodash/pick';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {SectionHeading} from 'app/components/charts/styles';
import CreateAlertButton from 'app/components/createAlertButton';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import TimeSince from 'app/components/timeSince';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {IconCheckmark, IconFire, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import styled from 'app/styled';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {Theme} from 'app/utils/theme';

import {Incident, IncidentStatus} from '../alerts/types';

const DOCS_URL = 'https://docs.sentry.io/workflow/alerts-notifications/alerts/';

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
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {location, organization} = this.props;

    const query = {
      ...pick(location.query, [...Object.values(URL_PARAM)]),
      per_page: 3,
    };

    // we are listing 3 alerts total, first unresolved and then we fill with resolved
    return [
      [
        'unresolvedAlerts',
        `/organizations/${organization.slug}/incidents/`,
        {query: {...query, status: IncidentStatus.OPENED}},
      ],
      [
        'resolvedAlerts',
        `/organizations/${organization.slug}/incidents/`,
        {query: {...query, status: IncidentStatus.CLOSED}},
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

  renderAlertRow = (alert: Incident) => {
    const {organization, theme} = this.props;
    const isResolved = alert.status === IncidentStatus.CLOSED;
    const isWarning = alert.status === IncidentStatus.WARNING;

    const color = isResolved ? theme.gray200 : isWarning ? theme.yellow300 : theme.red300;
    const Icon = isResolved ? IconCheckmark : isWarning ? IconWarning : IconFire;

    return (
      <AlertRowLink
        to={`/organizations/${organization.slug}/alerts/${alert.identifier}/`}
        key={alert.id}
      >
        <AlertBadge color={color} icon={Icon}>
          <AlertIconWrapper>
            <Icon color="white" />
          </AlertIconWrapper>
        </AlertBadge>
        <AlertDetails>
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDate color={color}>
            {isResolved
              ? tct('Resolved [date]', {date: <TimeSince date={alert.dateClosed!} />})
              : tct('Triggered [date]', {date: <TimeSince date={alert.dateStarted} />})}
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
      return <Placeholder height="160px" />;
    }

    if (!hasAlertRule) {
      return (
        <StyledButtonBar gap={1}>
          <CreateAlertButton
            organization={organization}
            iconProps={{size: 'xs'}}
            size="small"
            priority="primary"
            referrer="project_detail"
            projectSlug={projectSlug}
            hideIcon
          >
            {t('Create Alert Rule')}
          </CreateAlertButton>
          <Button size="small" external href={DOCS_URL}>
            {t('Learn More')}
          </Button>
        </StyledButtonBar>
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
      <Section>
        <SectionHeading>{t('Latest Alerts')}</SectionHeading>
        <div>{this.renderInnerBody()}</div>
      </Section>
    );
  }
}

const Section = styled('section')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  grid-template-columns: minmax(auto, max-content) minmax(auto, max-content);
`;

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
  margin-left: ${space(2)};
  ${overflowEllipsis}
`;

const AlertTitle = styled('h5')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 400;
  margin-bottom: ${space(0.25)};
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlertDate = styled('span')<{color: string}>`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.color};
`;

export default withTheme(ProjectLatestAlerts);

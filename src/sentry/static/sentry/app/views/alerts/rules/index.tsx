import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';

import {addErrorMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import * as Layout from 'app/components/layouts/thirds';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Pagination from 'app/components/pagination';
import {PanelTable, PanelTableHeader} from 'app/components/panels';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconArrow, IconCheckmark} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {IssueAlertRule} from 'app/types/alerts';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Projects from 'app/utils/projects';

import AlertHeader from '../list/header';
import {isIssueAlert} from '../utils';

import RuleListRow from './row';

const DEFAULT_SORT: {asc: boolean; field: 'date_added'} = {
  asc: false,
  field: 'date_added',
};
const DOCS_URL =
  'https://docs.sentry.io/workflow/alerts-notifications/alerts/?_ga=2.21848383.580096147.1592364314-1444595810.1582160976';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
};

type State = {
  ruleList?: IssueAlertRule[];
};

class AlertRulesList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location} = this.props;
    const {query} = location;

    return [
      [
        'ruleList',
        `/organizations/${params && params.orgId}/combined-rules/`,
        {
          query,
        },
      ],
    ];
  }

  tryRenderEmpty() {
    const {ruleList} = this.state;
    if (ruleList && ruleList.length > 0) {
      return null;
    }

    return (
      <React.Fragment>
        {
          <IconWrapper>
            <IconCheckmark isCircled size="48" />
          </IconWrapper>
        }
        {<Title>{t('No alert rules exist for these projects.')}</Title>}
        {
          <Description>
            {tct('Learn more about [link:Alerts]', {
              link: <ExternalLink href={DOCS_URL} />,
            })}
          </Description>
        }
      </React.Fragment>
    );
  }

  handleDeleteRule = async (projectId: string, rule: IssueAlertRule) => {
    const {params} = this.props;
    const {orgId} = params;
    const alertPath = isIssueAlert(rule) ? 'rules' : 'alert-rules';

    try {
      await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/${alertPath}/${rule.id}/`,
        {
          method: 'DELETE',
        }
      );
      this.reloadData();
    } catch (_err) {
      addErrorMessage(t('Error deleting rule'));
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderList() {
    const {
      params: {orgId},
      location: {query},
      organization,
    } = this.props;
    const {loading, ruleList = [], ruleListPageLinks} = this.state;

    const allProjectsFromIncidents = new Set(
      flatten(ruleList?.map(({projects}) => projects))
    );

    const sort = {
      ...DEFAULT_SORT,
      asc: query.asc === '1',
      // Currently only supported sorting field is 'date_added'
    };

    return (
      <StyledLayoutBody>
        <Layout.Main fullWidth>
          <StyledPanelTable
            headers={[
              t('Type'),
              t('Alert Name'),
              t('Project'),
              t('Created By'),
              // eslint-disable-next-line react/jsx-key
              <StyledSortLink
                to={{
                  pathname: `/organizations/${orgId}/alerts/rules/`,
                  query: {
                    ...query,
                    asc: sort.asc ? undefined : '1',
                  },
                }}
              >
                {t('Created')}{' '}
                <IconArrow
                  color="gray300"
                  size="xs"
                  direction={sort.asc ? 'up' : 'down'}
                />
              </StyledSortLink>,
              t('Actions'),
            ]}
            isLoading={loading}
            isEmpty={ruleList?.length === 0}
            emptyMessage={this.tryRenderEmpty()}
          >
            <Projects orgId={orgId} slugs={Array.from(allProjectsFromIncidents)}>
              {({initiallyLoaded, projects}) =>
                ruleList.map(rule => (
                  <RuleListRow
                    // Metric and issue alerts can have the same id
                    key={`${isIssueAlert(rule) ? 'metric' : 'issue'}-${rule.id}`}
                    projectsLoaded={initiallyLoaded}
                    projects={projects as Project[]}
                    rule={rule}
                    orgId={orgId}
                    onDelete={this.handleDeleteRule}
                    organization={organization}
                  />
                ))
              }
            </Projects>
          </StyledPanelTable>
          <Pagination pageLinks={ruleListPageLinks} />
        </Layout.Main>
      </StyledLayoutBody>
    );
  }

  renderBody() {
    const {params, organization, router} = this.props;
    const {orgId} = params;

    return (
      <SentryDocumentTitle title={t('Alerts')} objSlug={orgId}>
        <GlobalSelectionHeader organization={organization} showDateSelector={false}>
          <AlertHeader organization={organization} router={router} activeTab="rules" />
          {this.renderList()}
        </GlobalSelectionHeader>
      </SentryDocumentTitle>
    );
  }
}

class AlertRulesListContainer extends React.Component<Props> {
  componentDidMount() {
    this.trackView();
  }

  componentDidUpdate(nextProps: Props) {
    if (nextProps.location.query?.sort !== this.props.location.query?.sort) {
      this.trackView();
    }
  }

  trackView() {
    const {organization, location} = this.props;

    trackAnalyticsEvent({
      eventKey: 'alert_rules.viewed',
      eventName: 'Alert Rules: Viewed',
      organization_id: organization.id,
      sort: location.query.sort,
    });
  }

  render() {
    return <AlertRulesList {...this.props} />;
  }
}

export default AlertRulesListContainer;

const StyledLayoutBody = styled(Layout.Body)`
  margin-bottom: -20px;
`;

const StyledSortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }
`;

const StyledPanelTable = styled(PanelTable)`
  ${PanelTableHeader} {
    line-height: normal;
  }
  font-size: ${p => p.theme.fontSizeMedium};
  grid-template-columns: auto 1.5fr 1fr 1fr 1fr auto;
  margin-bottom: 0;
  white-space: nowrap;
  ${p =>
    p.emptyMessage &&
    `svg:not([data-test-id='icon-check-mark']) {
    display: none;`}
`;

const IconWrapper = styled('span')`
  color: ${p => p.theme.gray200};
  display: block;
`;

const Title = styled('strong')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
`;

const Description = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
  display: block;
  margin: 0;
`;

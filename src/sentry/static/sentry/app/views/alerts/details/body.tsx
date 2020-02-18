import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {
  AlertRuleAggregations,
  AlertRuleThresholdType,
  Trigger,
} from 'app/views/settings/incidentRules/types';
import {NewQuery, Project} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {defined} from 'app/utils';
import {getDisplayForAlertRuleAggregation} from 'app/views/alerts/utils';
import {getUtcDateString} from 'app/utils/dates';
import {t} from 'app/locale';
import Duration from 'app/components/duration';
import EventView from 'app/views/eventsV2/eventView';
import Feature from 'app/components/acl/feature';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import NavTabs from 'app/components/navTabs';
import Placeholder from 'app/components/placeholder';
import SeenByList from 'app/components/seenByList';
import {IconEdit} from 'app/icons/iconEdit';
import Projects from 'app/utils/projects';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import {Incident} from '../types';
import Activity from './activity';
import Chart from './chart';
import SideHeader from './sideHeader';

type Props = {
  incident?: Incident;
} & RouteComponentProps<{alertId: string; orgId: string}, {}>;

export default class DetailsBody extends React.Component<Props> {
  getDiscoverUrl(projects: Project[]) {
    const {incident, params} = this.props;
    const {orgId} = params;

    if (!projects || !projects.length || !incident) {
      return '';
    }

    const discoverQuery: NewQuery = {
      id: undefined,
      name: (incident && incident.title) || '',
      fields: ['issue', 'count(id)', 'count_unique(user.id)'],
      widths: ['400', '200', '-1'],
      orderby:
        incident.alertRule?.aggregation === AlertRuleAggregations.UNIQUE_USERS
          ? '-count_unique_user_id'
          : '-count_id',
      query: (incident && incident.query) || '',
      projects: projects
        .filter(({slug}) => incident.projects.includes(slug))
        .map(({id}) => Number(id)),
      version: 2 as const,
      start: incident.dateStarted,
      end: getUtcDateString(new Date()),
    };

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    const {query, ...toObject} = discoverView.getResultsViewUrlTarget(orgId);

    return {
      query: {...query, interval: `${incident.alertRule.timeWindow}m`},
      ...toObject,
    };
  }

  /**
   * Return a string describing the threshold based on the threshold and the type
   */
  getThresholdText(
    trigger: Trigger | undefined,
    key: 'alertThreshold' | 'resolveThreshold'
  ) {
    if (!trigger || typeof trigger[key] !== 'number') {
      return '';
    }

    const isAbove = trigger.thresholdType === AlertRuleThresholdType.ABOVE;
    const isAlert = key === 'alertThreshold';
    const direction = isAbove === isAlert ? '>' : '<';

    return `${direction} ${trigger[key]}`;
  }

  renderRuleDetails() {
    const {incident} = this.props;

    const criticalTrigger = incident?.alertRule.triggers.find(
      ({label}) => label === 'critical'
    );
    const warningTrigger = incident?.alertRule.triggers.find(
      ({label}) => label === 'warning'
    );

    return (
      <RuleDetails>
        <span>{t('Metric')}</span>
        <span>
          {incident && getDisplayForAlertRuleAggregation(incident.alertRule?.aggregation)}
        </span>

        <span>{t('Critical Trigger')}</span>
        <span>{this.getThresholdText(criticalTrigger, 'alertThreshold')}</span>

        {defined(criticalTrigger?.resolveThreshold) && (
          <React.Fragment>
            <span>{t('Critical Resolution')}</span>
            <span>{this.getThresholdText(criticalTrigger, 'resolveThreshold')}</span>
          </React.Fragment>
        )}

        {defined(warningTrigger) && (
          <React.Fragment>
            <span>{t('Warning Trigger')}</span>
            <span>{this.getThresholdText(warningTrigger, 'alertThreshold')}</span>

            {defined(warningTrigger?.resolveThreshold) && (
              <React.Fragment>
                <span>{t('Warning Resolution')}</span>
                <span>{this.getThresholdText(warningTrigger, 'resolveThreshold')}</span>
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        <span>{t('Time Window')}</span>
        <span>{incident && <Duration seconds={incident.alertRule.timeWindow} />}</span>
      </RuleDetails>
    );
  }

  render() {
    const {params, incident} = this.props;

    return (
      <StyledPageContent>
        <ChartWrapper>
          {incident ? (
            <Chart
              aggregation={incident.alertRule?.aggregation}
              data={incident.eventStats.data}
              detected={incident.dateDetected}
              closed={incident.dateClosed}
            />
          ) : (
            <Placeholder height="200px" />
          )}
        </ChartWrapper>

        <Main>
          <ActivityPageContent>
            <StyledNavTabs underlined>
              <li className="active">
                <Link>{t('Activity')}</Link>
              </li>

              <SeenByTab>
                {incident && (
                  <StyledSeenByList
                    iconPosition="right"
                    seenBy={incident.seenBy}
                    iconTooltip={t('People who have viewed this incident')}
                  />
                )}
              </SeenByTab>
            </StyledNavTabs>
            <Activity
              params={params}
              incidentStatus={!!incident ? incident.status : null}
            />
          </ActivityPageContent>
          <Sidebar>
            <PageContent>
              {incident?.alertRule && (
                <React.Fragment>
                  <SideHeader>
                    <span>{t('Alert Rule')}</span>

                    <SideHeaderLink
                      to={{
                        pathname: `/settings/${params.orgId}/projects/${incident?.projects[0]}/alerts-v2/metric-rules/${incident?.alertRule.id}/`,
                      }}
                    >
                      <IconEdit />
                      {t('View Rule')}
                    </SideHeaderLink>
                  </SideHeader>

                  {this.renderRuleDetails()}

                  <SideHeader>
                    <span>{t('Query')}</span>
                    <Feature features={['discover-basic']}>
                      <Projects
                        slugs={incident && incident.projects}
                        orgId={params.orgId}
                      >
                        {({initiallyLoaded, projects, fetching}) => (
                          <SideHeaderLink
                            disabled={!incident || fetching || !initiallyLoaded}
                            to={this.getDiscoverUrl(
                              ((initiallyLoaded && projects) as Project[]) || []
                            )}
                          >
                            <InlineSvg src="icon-telescope" />
                            {t('View in Discover')}
                          </SideHeaderLink>
                        )}
                      </Projects>
                    </Feature>
                  </SideHeader>

                  <Query>{incident?.alertRule.query || '""'}</Query>
                </React.Fragment>
              )}
            </PageContent>
          </Sidebar>
        </Main>
      </StyledPageContent>
    );
  }
}

const Main = styled('div')`
  display: flex;
  flex: 1;
  border-top: 1px solid ${p => p.theme.borderLight};
  background-color: ${p => p.theme.white};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-direction: column-reverse;
  }
`;

const ActivityPageContent = styled(PageContent)`
  width: 60%;
  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
    margin-bottom: 0;
  }
`;

const Sidebar = styled('div')`
  width: 40%;

  ${PageContent} {
    padding-top: ${space(3)};
  }

  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
    border: 0;

    ${PageContent} {
      padding-top: ${space(3)};
      margin-bottom: 0;
      border-bottom: 1px solid ${p => p.theme.borderLight};
    }
  }
`;

const SideHeaderLink = styled(Link)`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  grid-gap: ${space(0.5)};
  text-transform: none;
`;

const StyledPageContent = styled(PageContent)`
  padding: 0;
  flex-direction: column;
`;

const ChartWrapper = styled('div')`
  padding: ${space(2)};
`;

const StyledNavTabs = styled(NavTabs)`
  display: flex;
`;

const SeenByTab = styled('li')`
  flex: 1;
  margin-left: ${space(2)};
  margin-right: 0;

  .nav-tabs > & {
    margin-right: 0;
  }
`;

const StyledSeenByList = styled(SeenByList)`
  margin-top: 0;
`;

const RuleDetails = styled('div')`
  display: grid;
  font-size: ${p => p.theme.fontSizeMedium};
  grid-template-columns: auto max-content;
  margin-bottom: ${space(2)};

  & > span {
    padding: ${space(0.25)} ${space(1)};
  }

  & > span:nth-child(2n + 2) {
    text-align: right;
  }

  & > span:nth-child(4n + 1),
  & > span:nth-child(4n + 2) {
    background-color: ${p => p.theme.offWhite2};
  }
`;

const Query = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  background-color: ${p => p.theme.offWhite2};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.5)} ${space(1)};
  color: ${p => p.theme.gray4};
`;

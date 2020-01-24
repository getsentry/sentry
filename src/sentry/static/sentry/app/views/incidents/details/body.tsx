import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {NewQuery, Project} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import EventView from 'app/views/eventsV2/eventView';
import Feature from 'app/components/acl/feature';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import NavTabs from 'app/components/navTabs';
import Placeholder from 'app/components/placeholder';
import Projects from 'app/utils/projects';
import SeenByList from 'app/components/seenByList';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import {Incident} from '../types';
import Activity from './activity';
import Chart from './chart';
import SideHeader from './sideHeader';

type Props = {
  incident?: Incident;
} & RouteComponentProps<{incidentId: string; orgId: string}, {}>;

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
      fields: ['title', 'user', 'last_seen'],
      widths: ['400', '200', '-1'],
      orderby: '-last_seen',
      query: (incident && incident.query) || '',
      projects: projects
        .filter(({slug}) => incident.projects.includes(slug))
        .map(({id}) => Number(id)),
      version: 2 as const,
      range: '24h',
    };

    const discoverView = EventView.fromSavedQuery(discoverQuery);

    return {
      pathname: `/organizations/${orgId}/eventsv2/results/`,
      query: discoverView.generateQueryStringObject(),
    };
  }

  render() {
    const {params, incident} = this.props;

    return (
      <StyledPageContent>
        <ChartWrapper>
          {incident ? (
            <Chart
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
              <RuleDetails>
                <SideHeader>{t('Metric')}</SideHeader>
                <SideHeader>{t('Threshold')}</SideHeader>
                <SideHeader>{t('Time Interval')}</SideHeader>

                <span>Events</span>
                <span>> 1000</span>
                <span>1 hour</span>
              </RuleDetails>

              <SideHeader>
                <span>{t('Query')}</span>
                <Feature features={['discover-basic']}>
                  <Projects slugs={incident && incident.projects} orgId={params.orgId}>
                    {({initiallyLoaded, projects, fetching}) => (
                      <DiscoverLink
                        disabled={!incident || fetching || !initiallyLoaded}
                        to={this.getDiscoverUrl(
                          ((initiallyLoaded && projects) as Project[]) || []
                        )}
                      >
                        <DiscoverIcon src="icon-telescope" />
                        {t('View in Discover')}
                      </DiscoverLink>
                    )}
                  </Projects>
                </Feature>
              </SideHeader>

              <Query>user.username:"Jane Doe" server:web-8 example error</Query>

              <EditRuleLink to="#">
                <InlineSvg src="icon-edit" size="14px" />
                {t('Edit alert rule')}
              </EditRuleLink>
            </PageContent>
          </Sidebar>
        </Main>
      </StyledPageContent>
    );
  }
}

const Main = styled('div')`
  display: flex;
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

const DiscoverLink = styled(Link)`
  text-transform: none;
`;

const DiscoverIcon = styled(InlineSvg)`
  margin-right: ${space(0.5)};
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
  grid-template-columns: repeat(3, 1fr);
  grid-gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(2)};
`;

const Query = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  background-color: ${p => p.theme.offWhite2};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.5)} ${space(1)};
  color: ${p => p.theme.gray4};
`;

const EditRuleLink = styled(Link)`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: flex-start;
  grid-gap: ${space(0.5)};
  margin-top: ${space(2)};
`;

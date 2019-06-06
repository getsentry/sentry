import React from 'react';
import styled from 'react-emotion';

import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import IdBadge from 'app/components/idBadge';
import Chart from 'app/views/organizationIncidents/details/chart';
import Link from 'app/components/links/link';
import NavTabs from 'app/components/navTabs';
import Projects from 'app/utils/projects';
import SeenByList from 'app/components/seenByList';
import SentryTypes from 'app/sentryTypes';
import SideHeader from 'app/views/organizationIncidents/details/sideHeader';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import Activity from './activity';
import IncidentsSuspects from './suspects';

export default class DetailsBody extends React.Component {
  static propTypes = {
    incident: SentryTypes.Incident,
  };

  render() {
    const {params, incident} = this.props;

    return (
      <StyledPageContent>
        <Main>
          <PageContent>
            <StyledNavTabs underlined={true}>
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
              incidentStatus={incident ? incident.status : null}
            />
          </PageContent>
        </Main>
        <Sidebar>
          <PageContent>
            <SideHeader>{t('Events in Incident')}</SideHeader>
            {incident ? (
              <Chart
                data={incident.eventStats.data}
                detected={incident.dateDetected}
                closed={incident.dateClosed}
              />
            ) : (
              <ChartPlaceholder />
            )}

            <IncidentsSuspects suspects={[]} />

            <div>
              <SidebarHeading>
                Projects Affected ({incident ? incident.projects.length : '-'})
              </SidebarHeading>

              {incident && (
                <div>
                  <Projects slugs={incident.projects} orgId={params.orgId}>
                    {({projects, fetching}) => {
                      return projects.map(project => (
                        <StyledIdBadge key={project.slug} project={project} />
                      ));
                    }}
                  </Projects>
                </div>
              )}
            </div>
          </PageContent>
        </Sidebar>
      </StyledPageContent>
    );
  }
}

const Main = styled('div')`
  width: 60%;
  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
  }
`;

const Sidebar = styled('div')`
  width: 40%;
  border-left: 1px solid ${p => p.theme.borderLight};
  background-color: ${p => p.theme.white};
  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
    border: 0;
  }
`;

const StyledPageContent = styled(PageContent)`
  padding: 0;
  flex-direction: row;
  @media (max-width: ${theme.breakpoints[0]}) {
    flex-direction: column;
  }
`;

const StyledNavTabs = styled(NavTabs)`
  display: flex;
`;
const SeenByTab = styled('li')`
  flex: 1;
  margin-left: ${space(2)};

  .nav-tabs > & {
    margin-right: 0;
  }
`;

const StyledSeenByList = styled(SeenByList)`
  margin-top: 0;
`;

const ChartPlaceholder = styled('div')`
  background-color: ${p => p.theme.offWhite};
  height: 190px;
  margin-bottom: 10px;
`;

const SidebarHeading = styled('h6')`
  color: ${p => p.theme.gray3};
  margin: ${space(2)} 0 ${space(1)} 0;
  text-transform: uppercase;
`;

const StyledIdBadge = styled(IdBadge)`
  margin-bottom: ${space(1)};
`;

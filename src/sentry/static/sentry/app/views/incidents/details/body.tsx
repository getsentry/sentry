import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from 'react-emotion';

import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import Chart from 'app/views/incidents/details/chart';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import NavTabs from 'app/components/navTabs';
import Placeholder from 'app/components/placeholder';
import Projects from 'app/utils/projects';
import SeenByList from 'app/components/seenByList';
import SideHeader from 'app/views/incidents/details/sideHeader';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import Activity from './activity';
import RelatedIssues from './relatedIssues';
import Suspects from './suspects';

import {Incident} from '../types';

type Props = {
  incident?: Incident;
} & RouteComponentProps<{incidentId: string; orgId: string}, {}>;

export default class DetailsBody extends React.Component<Props> {
  render() {
    const {params, incident} = this.props;

    return (
      <StyledPageContent>
        <Main>
          <PageContent>
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
          </PageContent>
        </Main>
        <Sidebar>
          <PageContent>
            <SideHeader loading={!incident}>{t('Events in Incident')}</SideHeader>

            {incident ? (
              <Chart
                data={incident.eventStats.data}
                detected={incident.dateDetected}
                closed={incident.dateClosed}
              />
            ) : (
              <Placeholder height="190px" bottomGutter={2} />
            )}

            <div>
              <SideHeader loading={!incident}>
                {t('Projects Affected')} ({incident ? incident.projects.length : '-'})
              </SideHeader>

              {incident && (
                <div>
                  <Projects slugs={incident.projects} orgId={params.orgId}>
                    {({projects}) => {
                      return projects.map(project => (
                        <StyledIdBadge key={project.slug} project={project} />
                      ));
                    }}
                  </Projects>
                </div>
              )}
            </div>

            <Suspects {...this.props} />

            <RelatedIssues params={params} incident={incident} />
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

  ${PageContent} {
    padding-top: ${space(3)};
  }

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
  margin-right: 0;

  .nav-tabs > & {
    margin-right: 0;
  }
`;

const StyledSeenByList = styled(SeenByList)`
  margin-top: 0;
`;

const StyledIdBadge = styled(IdBadge)`
  margin-bottom: ${space(1)};
`;

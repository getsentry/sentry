import {Fragment} from 'react';
import styled from '@emotion/styled';
import random from 'lodash/random';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import BarChart from 'app/components/charts/barChart';
import {DateTimeObject} from 'app/components/charts/utils';
import IdBadge from 'app/components/idBadge';
import LoadingIndicator from 'app/components/loadingIndicator';
import PanelTable from 'app/components/panels/panelTable';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';

import DescriptionCard from './descriptionCard';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
} & DateTimeObject;

type State = AsyncComponent['state'] & {};

class TeamIssues extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
    };
  }

  getEndpoints() {
    // TODO(workflow): Make team issues request
    return [];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {projects} = this.props;
    const {isLoading} = this.state;

    return (
      <Fragment>
        <DescriptionCard
          title={t('Issues Reviewed')}
          description={t(
            'Issues that were triaged by your team taking an action on them such as resolving, ignoring, marking as reviewed, or deleting.'
          )}
        >
          <IssuesChartWrapper>
            {isLoading && <Placeholder height="200px" />}
            {!isLoading && (
              <BarChart
                style={{height: 200}}
                stacked
                isGroupedByDate
                legend={{right: 0, top: 0}}
                series={[
                  {
                    seriesName: t('Reviewed'),
                    data: Array(12)
                      .fill(0)
                      .map((_, i) => {
                        return {
                          value: random(1, 5, true),
                          name: moment().startOf('day').subtract(i, 'd').toISOString(),
                        };
                      }),
                  },
                  {
                    seriesName: t('Not Reviewed'),
                    data: Array(12)
                      .fill(0)
                      .map((_, i) => {
                        return {
                          value: random(1, 5, true),
                          name: moment().startOf('day').subtract(i, 'd').toISOString(),
                        };
                      }),
                  },
                ]}
              />
            )}
          </IssuesChartWrapper>
          <StyledPanelTable
            headers={[t('Project'), t('For Review'), t('Reviewed'), t('% Reviewed')]}
            isLoading={isLoading}
          >
            {projects.map(project => (
              <Fragment key={project.id}>
                <ProjectBadgeContainer>
                  <ProjectBadge avatarSize={18} project={project} />
                </ProjectBadgeContainer>
                <div>{'\u2014'}</div>
                <div>{'\u2014'}</div>
                <div>{'\u2014'}</div>
              </Fragment>
            ))}
          </StyledPanelTable>
        </DescriptionCard>

        <DescriptionCard
          title={t('Time to Resolution')}
          description={t(
            `This shows the mean time it took for issues to be resolved by your team.
                 If issues took a long time to resolve, this could be a problem that your team needs to fix.`
          )}
        >
          <ChartWrapper>
            {isLoading && <StyledLoadingIndicator />}
            {!isLoading && (
              <BarChart
                style={{height: 200}}
                isGroupedByDate
                legend={{right: 0, top: 0}}
                series={[
                  {
                    seriesName: t('Manually Resolved'),
                    data: Array(12)
                      .fill(0)
                      .map((_, i) => {
                        return {
                          value: random(1, 5, true),
                          name: moment().startOf('day').subtract(i, 'd').toISOString(),
                        };
                      }),
                  },
                ].reverse()}
              />
            )}
          </ChartWrapper>
        </DescriptionCard>
      </Fragment>
    );
  }
}

export default TeamIssues;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;

const IssuesChartWrapper = styled(ChartWrapper)`
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr;
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
`;

const ProjectBadgeContainer = styled('div')`
  display: flex;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: ${space(5)};
`;

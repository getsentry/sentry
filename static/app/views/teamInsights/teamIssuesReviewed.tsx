import {Fragment} from 'react';
import styled from '@emotion/styled';
import chunk from 'lodash/chunk';

import AsyncComponent from 'app/components/asyncComponent';
import BarChart from 'app/components/charts/barChart';
import {DateTimeObject} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import PanelTable from 'app/components/panels/panelTable';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';

type AlertsTriggered = Record<string, number>;

type Props = AsyncComponent['props'] & {
  organization: Organization;
  teamSlug: string;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  alertsTriggered: AlertsTriggered | null;
};

class TeamIssues extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      alertsTriggered: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, start, end, period, utc, teamSlug} = this.props;
    const datetime = {start, end, period, utc};

    return [
      [
        'alertsTriggered',
        `/teams/${organization.slug}/${teamSlug}/alerts-triggered/`,
        {
          query: {
            ...getParams(datetime),
          },
        },
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    const {start, end, period, utc, teamSlug} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.teamSlug !== teamSlug
    ) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {alertsTriggered} = this.state;
    const data = Object.entries(alertsTriggered ?? {})
      .map(([bucket, count]) => ({
        value: count,
        name: new Date(bucket).getTime(),
      }))
      .sort((a, b) => a.name - b.name);

    // Convert from days to 7 day groups
    const seriesData = chunk(data, 7).map(week => {
      return {
        name: week[0].name,
        value: week.reduce((total, currentData) => total + currentData.value, 0),
      };
    });

    return (
      <Fragment>
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
                  data: seriesData,
                },
                {
                  seriesName: t('Not Reviewed'),
                  data: seriesData,
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

import styled from '@emotion/styled';

import {BarChart} from 'sentry/components/charts/barChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Automation, AutomationStats} from 'sentry/types/workflowEngine/automations';
import {getUtcDateString} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface IssueAlertDetailsProps extends DateTimeObject {
  automationId: Automation['id'];
}

export function AutomationStatsChart({
  automationId,
  period,
  start,
  end,
  utc,
}: IssueAlertDetailsProps) {
  const organization = useOrganization();
  const chartZoomProps = useChartZoom({saveOnZoom: true});
  const {
    data: fireHistory,
    isPending,
    isError,
  } = useApiQuery<AutomationStats[]>(
    [
      `/organizations/${organization.slug}/workflows/${automationId}/stats/`,
      {
        query: {
          ...(period && {statsPeriod: period}),
          start: start ? getUtcDateString(start) : undefined,
          end: end ? getUtcDateString(end) : undefined,
          utc: utc ? 'true' : undefined,
        },
      },
    ],
    {staleTime: 30000}
  );

  const totalAlertsTriggered =
    fireHistory?.reduce((acc, curr) => acc + curr.count, 0) ?? 0;

  return (
    <Panel>
      <StyledPanelBody withPadding>
        <ChartHeader>
          <HeaderTitleLegend>{t('Alerts Triggered')}</HeaderTitleLegend>
        </ChartHeader>
        {isPending && <Placeholder height="200px" />}
        {isError && <LoadingError />}
        {fireHistory && (
          <BarChart
            {...chartZoomProps}
            showTimeInTooltip
            grid={{
              left: space(0.25),
              right: space(2),
              top: space(3),
              bottom: 0,
            }}
            yAxis={{
              minInterval: 1,
            }}
            series={[
              {
                seriesName: t('Alerts Triggered'),
                data: fireHistory.map(automation => ({
                  name: automation.date,
                  value: automation.count,
                })),
                emphasis: {
                  disabled: true,
                },
                animation: false,
              },
            ]}
          />
        )}
      </StyledPanelBody>
      <ChartFooter>
        <FooterHeader>{t('Total Triggers')}</FooterHeader>
        <FooterValue>
          {isPending ? (
            <Placeholder height="16px" width="50px" />
          ) : (
            totalAlertsTriggered.toLocaleString()
          )}
        </FooterValue>
      </ChartFooter>
    </Panel>
  );
}

const ChartHeader = styled('div')`
  margin-bottom: ${space(3)};
`;

const ChartFooter = styled(PanelFooter)`
  display: flex;
  align-items: center;
  padding: ${space(1)} 20px;
`;

const FooterHeader = styled('h4')`
  margin: 0;
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1;
`;

const FooterValue = styled('div')`
  display: flex;
  align-items: center;
  margin: 0 ${space(1)};
`;

/* Override padding to make chart appear centered */
const StyledPanelBody = styled(PanelBody)`
  padding-right: 6px;
`;

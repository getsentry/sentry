import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex} from '@sentry/scraps/layout';

import {BarChart} from 'sentry/components/charts/barChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelFooter} from 'sentry/components/panels/panelFooter';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getUtcDateString, getUtcToLocalDateObject} from 'sentry/utils/dates';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

interface IssueAlertDetailsProps extends DateTimeObject {
  automationId: Automation['id'];
}

type WorkflowStatsResponse = {
  meta: {
    dataset: string;
    end: number;
    start: number;
  };
  timeSeries: [TimeSeries];
};

export function AutomationStatsChart({
  automationId,
  period,
  start,
  end,
  utc,
}: IssueAlertDetailsProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const chartZoomProps = useChartZoom({saveOnZoom: true});
  const {
    data: stats,
    isPending,
    isError,
  } = useQuery(
    apiOptions.as<WorkflowStatsResponse>()(
      '/organizations/$organizationIdOrSlug/workflows/$workflowId/stats/',
      {
        path: {organizationIdOrSlug: organization.slug, workflowId: automationId},
        query: {
          ...(period && {statsPeriod: period}),
          start: start ? getUtcDateString(start) : undefined,
          end: end ? getUtcDateString(end) : undefined,
          utc: utc ? 'true' : undefined,
        },
        staleTime: 30_000,
      }
    )
  );

  const totalAlertsTriggered =
    stats?.timeSeries[0].values.reduce((acc, curr) => acc + (curr.value ?? 0), 0) ?? 0;

  return (
    <Panel>
      <StyledPanelBody withPadding>
        <Container marginBottom="2xl">
          <HeaderTitleLegend>{t('Alerts Triggered')}</HeaderTitleLegend>
        </Container>
        {isPending && <Placeholder height="200px" />}
        {isError && <LoadingError />}
        {stats && (
          <BarChart
            {...chartZoomProps}
            period={period}
            showTimeInTooltip
            start={start ? getUtcToLocalDateObject(start) : undefined}
            end={end ? getUtcToLocalDateObject(end) : undefined}
            utc={utc ?? undefined}
            grid={{
              left: theme.space['2xs'],
              right: theme.space.xl,
              top: theme.space['2xl'],
              bottom: 0,
            }}
            yAxis={{
              minInterval: 1,
            }}
            xAxis={{
              min: stats.meta.start,
              max: stats.meta.end,
            }}
            series={[
              {
                seriesName: t('Alerts Triggered'),
                data: stats.timeSeries[0].values.map(({timestamp, value}) => ({
                  name: timestamp,
                  value: value ?? 0,
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
        <Flex align="center" margin="0 md">
          {isPending ? (
            <Placeholder height="16px" width="50px" />
          ) : (
            totalAlertsTriggered.toLocaleString()
          )}
        </Flex>
      </ChartFooter>
    </Panel>
  );
}

const ChartFooter = styled(PanelFooter)`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.md} 20px;
`;

const FooterHeader = styled('h4')`
  margin: 0;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1;
`;

/* Override padding to make chart appear centered */
const StyledPanelBody = styled(PanelBody)`
  padding-right: 6px;
`;

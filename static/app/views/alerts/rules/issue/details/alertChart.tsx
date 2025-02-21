import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IssueAlertRule, ProjectAlertRuleStats} from 'sentry/types/alerts';
import type {Project} from 'sentry/types/project';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import RouteError from 'sentry/views/routeError';

interface IssueAlertDetailsProps extends DateTimeObject {
  project: Project;
  rule: IssueAlertRule;
}

export function IssueAlertDetailsChart({
  project,
  period,
  start,
  end,
  utc,
  rule,
}: IssueAlertDetailsProps) {
  const organization = useOrganization();
  const {
    data: ruleFireHistory,
    isPending,
    isError,
    error,
  } = useApiQuery<ProjectAlertRuleStats[]>(
    [
      `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/stats/`,
      {
        query: {
          ...(period && {statsPeriod: period}),
          start,
          end,
          utc,
        },
      },
    ],
    {staleTime: 30000}
  );

  const totalAlertsTriggered =
    ruleFireHistory?.reduce((acc, curr) => acc + curr.count, 0) ?? 0;

  if (isError) {
    return <RouteError error={error} />;
  }

  return (
    <Panel>
      <StyledPanelBody withPadding>
        <ChartHeader>
          <HeaderTitleLegend>{t('Alerts Triggered')}</HeaderTitleLegend>
        </ChartHeader>
        {getDynamicText({
          value: isPending ? (
            <Placeholder height="200px" />
          ) : (
            <ChartZoom period={period} start={start} end={end} utc={utc} usePageDate>
              {zoomRenderProps => (
                <AreaChart
                  {...zoomRenderProps}
                  isGroupedByDate
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
                      seriesName: 'Alerts Triggered',
                      data:
                        ruleFireHistory?.map(alert => ({
                          name: alert.date,
                          value: alert.count,
                        })) ?? [],
                      emphasis: {
                        disabled: true,
                      },
                    },
                  ]}
                />
              )}
            </ChartZoom>
          ),
          fixed: <Placeholder height="200px" testId="skeleton-ui" />,
        })}
      </StyledPanelBody>
      <ChartFooter>
        <FooterHeader>{t('Total Alerts')}</FooterHeader>
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
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeMedium};
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

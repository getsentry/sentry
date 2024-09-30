import {useMemo} from 'react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Panel from 'sentry/components/panels/panel';
import {IconEllipsis, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {hasInsightsAlerts} from 'sentry/views/insights/common/utils/hasInsightsAlerts';
import {useModuleNameFromUrl} from 'sentry/views/insights/common/utils/useModuleNameFromUrl';
import {Subtitle} from 'sentry/views/performance/landing/widgets/widgets/singleFieldAreaWidget';

export type AlertConfig = {
  aggregate: string;
  name?: string;
  query?: string;
};

type Props = {
  children: React.ReactNode;
  alertConfigs?: AlertConfig[];
  button?: JSX.Element;
  className?: string;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
};

export default function ChartPanel({
  title,
  children,
  button,
  subtitle,
  alertConfigs,
  className,
}: Props) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {projects} = useProjects();
  const project = useMemo(
    () =>
      selection.projects.length === 1
        ? projects.find(p => p.id === `${selection.projects[0]}`)
        : undefined,
    [projects, selection.projects]
  );
  const moduleName = useModuleNameFromUrl();
  const alertsUrls =
    alertConfigs?.map(alertConfig => {
      // Alerts only support single project selection and one or all environment
      const singleProject = selection.projects.length === 1 && project;
      const singleEnvironment = selection.environments.length <= 1;
      const alertsUrl =
        alertConfig && singleProject && singleEnvironment
          ? getAlertsUrl({
              project,
              orgSlug: organization.slug,
              pageFilters: selection,
              name: typeof title === 'string' ? title : undefined,
              ...alertConfig,
            })
          : undefined;
      const name = alertConfig.name ?? 'Create Alert';
      const disabled = !singleProject || !singleEnvironment;
      const tooltip = !singleProject
        ? t(
            'Alerts are only available for single project selection. Update your project filter to create an alert.'
          )
        : !singleEnvironment
          ? t(
              'Alerts are only available with at most one environment selection. Update your environment filter to create an alert.'
            )
          : undefined;
      return {
        key: name,
        label: name,
        to: alertsUrl,
        disabled,
        tooltip,
        onClick: () => {
          trackAnalytics('insight.general.create_alert', {
            organization,
            chart_name: typeof title === 'string' ? title : undefined,
            alert_name: name,
            source: moduleName ?? undefined,
          });
        },
      };
    }) ?? [];

  const dropdownMenuItems = hasInsightsAlerts(organization) ? alertsUrls : [];

  return (
    <PanelWithNoPadding className={className}>
      <PanelBody>
        {title && (
          <Header data-test-id="chart-panel-header">
            {title && (
              <ChartLabel>
                {typeof title === 'string' ? (
                  <TextTitleContainer>{title}</TextTitleContainer>
                ) : (
                  title
                )}
              </ChartLabel>
            )}
            <MenuContainer>
              {button}
              {dropdownMenuItems.length > 0 && (
                <DropdownMenu
                  triggerProps={{
                    'aria-label': t('Chart Actions'),
                    size: 'xs',
                    borderless: true,
                    showChevron: false,
                    icon: <IconEllipsis direction="down" size="sm" />,
                  }}
                  position="bottom-end"
                  items={dropdownMenuItems}
                />
              )}
              <Button
                aria-label={t('Expand Insight Chart')}
                borderless
                size="xs"
                icon={<IconExpand />}
                onClick={() => {
                  openInsightChartModal({title, children});
                }}
              />
            </MenuContainer>
          </Header>
        )}
        {subtitle && (
          <SubtitleContainer>
            <Subtitle>{subtitle}</Subtitle>
          </SubtitleContainer>
        )}
        {children}
      </PanelBody>
    </PanelWithNoPadding>
  );
}

const PanelWithNoPadding = styled(Panel)`
  margin-bottom: 0;
`;

const TextTitleContainer = styled('div')`
  padding: 1px 0;
`;

const SubtitleContainer = styled('div')`
  padding-top: ${space(0.5)};
`;

const ChartLabel = styled('div')`
  ${p => p.theme.text.cardTitle}
`;

const PanelBody = styled('div')`
  padding: ${space(2)};
`;

const Header = styled('div')`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const MenuContainer = styled('span')`
  display: flex;
`;

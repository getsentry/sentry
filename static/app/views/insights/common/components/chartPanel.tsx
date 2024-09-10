import {useMemo} from 'react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Panel from 'sentry/components/panels/panel';
import {IconEllipsis, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {hasInsightsAlerts} from 'sentry/views/insights/common/utils/hasInsightsAlerts';
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
  const alertsUrls =
    alertConfigs?.map(alertConfig => {
      // Alerts only support single project selection
      const singleProject = selection.projects.length === 1 && project;
      const alertsUrl =
        alertConfig && singleProject
          ? getAlertsUrl({project, orgSlug: organization.slug, ...alertConfig})
          : undefined;
      const name = alertConfig.name ?? 'Create Alert';
      const disabled = !singleProject;
      return {
        key: name,
        label: name,
        to: alertsUrl,
        disabled,
        tooltip: disabled
          ? t(
              'Alerts are only available for single project selection. Update your project filter to create an alert.'
            )
          : undefined,
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

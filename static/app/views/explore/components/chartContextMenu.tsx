import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

function ChartContextMenu({
  visualizeIndex,
  visualizeYAxes,
  query,
  interval,
}: {
  interval: string;
  query: string;
  visualizeIndex: number;
  visualizeYAxes: string[];
}) {
  const {addToDashboard} = useAddToDashboard();
  const organization = useOrganization();

  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);
  const singleProject =
    (pageFilters.selection.projects.length === 1 || projects.length === 1) && project;

  const alertsUrls = singleProject
    ? visualizeYAxes.map(yAxis => ({
        key: yAxis,
        label: yAxis,
        to: getAlertsUrl({
          project,
          query,
          pageFilters: pageFilters.selection,
          aggregate: yAxis,
          orgSlug: organization.slug,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          interval,
        }),
      }))
    : undefined;

  const items: MenuItemProps[] = [];

  if (organization.features.includes('alerts-eap')) {
    items.push({
      key: 'create-alert',
      label: t('Create an alert for'),
      children: alertsUrls ?? [],
      tooltip: !singleProject
        ? t('Cannot create an alert when multiple projects are selected')
        : undefined,
      disabled: !alertsUrls || alertsUrls.length === 0 || !singleProject,
      isSubmenu: true,
    });
  }

  if (organization.features.includes('dashboards-eap')) {
    const disableAddToDashboard = !organization.features.includes('dashboards-edit');
    items.push({
      key: 'add-to-dashboard',
      textValue: t('Add to Dashboard'),
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('Add to Dashboard')}</DisabledText>}
        >
          {t('Add to Dashboard')}
        </Feature>
      ),
      disabled: disableAddToDashboard,
      onAction: !disableAddToDashboard ? () => addToDashboard(visualizeIndex) : undefined,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      triggerProps={{
        size: 'sm',
        borderless: true,
        showChevron: false,
        icon: <IconEllipsis />,
      }}
      position="bottom-end"
      items={items}
    />
  );
}

export default ChartContextMenu;

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;

import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  useExploreQuery,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {ToolbarSection} from 'sentry/views/explore/toolbar/styles';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

export function ToolbarSaveAs() {
  const {addToDashboard} = useAddToDashboard();
  const organization = useOrganization();

  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const query = useExploreQuery();
  const visualizes = useExploreVisualizes();
  const visualizeYAxes = visualizes.flatMap(v => v.yAxes);

  const [interval] = useChartInterval();

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
      onAction: !disableAddToDashboard ? () => addToDashboard(0) : undefined, // This is hardcoding
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <ToolbarSection data-test-id="section-save-as">
      <DropdownMenu
        items={items}
        trigger={triggerProps => (
          <SaveAsButton
            {...triggerProps}
            aria-label={t('Save as')}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();

              triggerProps.onClick?.(e);
            }}
          >
            {`${t('Save as')}\u2026`}
          </SaveAsButton>
        )}
      />
    </ToolbarSection>
  );
}

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;

const SaveAsButton = styled(Button)`
  width: 100%;
`;

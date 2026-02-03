import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

export const useTimeseriesVisualizationEnabled = () => {
  const organization = useOrganization();
  return hasTimeseriesVisualizationFeature(organization);
};

export const hasTimeseriesVisualizationFeature = (organization: Organization) => {
  return organization.features.includes('dashboards-widget-timeseries-visualization');
};

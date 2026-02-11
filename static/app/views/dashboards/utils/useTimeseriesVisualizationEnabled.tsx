import useOrganization from 'sentry/utils/useOrganization';

export const useTimeseriesVisualizationEnabled = () => {
  const organization = useOrganization();
  return organization.features.includes('dashboards-widget-timeseries-visualization');
};
